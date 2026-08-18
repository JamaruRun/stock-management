import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendShopLinePush } from '@/lib/line-push-server';
import { getGradeInfo } from '@/lib/parts-constants';

function adminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function daysSince(dateStr: string, todayD: Date) {
  const d = new Date(dateStr);
  return Math.max(0, Math.floor((todayD.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
}

const MIN_DAYS_FOR_INTERVAL: Record<string, number> = {
  weekly: 7,
  monthly: 30,
};

const MAX_ITEMS_IN_MESSAGE = 25;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const admin = adminClient();
  const today = todayStr();
  const todayD = new Date(today);

  const { data: shops } = await admin
    .from('shops')
    .select('id, parts_dead_stock_days, parts_dead_stock_interval, parts_dead_stock_last_sent_at');

  const dueShopIds: string[] = [];
  const dueShopMap: Record<string, any> = {};
  for (const shop of shops || []) {
    const interval = shop.parts_dead_stock_interval;
    if (!interval || interval === 'off') continue;

    const lastSent = shop.parts_dead_stock_last_sent_at;
    if (!lastSent) {
      // ยังไม่เคยส่ง - ตั้ง baseline วันนี้ก่อน ยังไม่ส่งรอบแรก
      await admin.from('shops').update({ parts_dead_stock_last_sent_at: today }).eq('id', shop.id);
      continue;
    }

    const elapsed = daysSince(lastSent, todayD);
    const minDays = MIN_DAYS_FOR_INTERVAL[interval];
    if (!minDays || elapsed < minDays) continue;

    dueShopIds.push(shop.id);
    dueShopMap[shop.id] = shop;
  }

  if (dueShopIds.length === 0) {
    return NextResponse.json({ success: true, dueShops: 0, shopsNotified: 0 });
  }

  const { data: parts } = await admin
    .from('parts')
    .select('id, shop_id, name, sku, cost_price, grade, stock_qty, created_at')
    .in('shop_id', dueShopIds)
    .gt('stock_qty', 0);

  const partIds = (parts || []).map((p: any) => p.id);

  const [{ data: moveTx }, { data: inTx }, { data: compatRows }] = await Promise.all([
    partIds.length > 0
      ? admin.from('part_transactions').select('part_id, created_at').in('part_id', partIds).in('type', ['out', 'used_in_repair'])
      : Promise.resolve({ data: [] } as any),
    partIds.length > 0
      ? admin.from('part_transactions').select('part_id, created_at').in('part_id', partIds).eq('type', 'in')
      : Promise.resolve({ data: [] } as any),
    partIds.length > 0
      ? admin.from('part_compatibility').select('part_id, device_models(model_name)').in('part_id', partIds)
      : Promise.resolve({ data: [] } as any),
  ]);

  const lastMove: Record<string, string> = {};
  for (const t of moveTx || []) {
    if (!t.part_id || !t.created_at) continue;
    if (!lastMove[t.part_id] || t.created_at > lastMove[t.part_id]) lastMove[t.part_id] = t.created_at;
  }
  const lastReceived: Record<string, string> = {};
  for (const t of inTx || []) {
    if (!t.part_id || !t.created_at) continue;
    if (!lastReceived[t.part_id] || t.created_at > lastReceived[t.part_id]) lastReceived[t.part_id] = t.created_at;
  }
  const modelsByPart: Record<string, string[]> = {};
  for (const r of compatRows || []) {
    const name = (r as any).device_models?.model_name;
    if (!name) continue;
    (modelsByPart[(r as any).part_id] ||= []).push(name);
  }

  let shopsNotified = 0;
  let deadStockTotal = 0;

  for (const shopId of dueShopIds) {
    const shop = dueShopMap[shopId];
    const deadDays = shop.parts_dead_stock_days || 90;
    const cutoff = todayD.getTime() - deadDays * 24 * 60 * 60 * 1000;

    const shopParts = (parts || []).filter((p: any) => p.shop_id === shopId);
    const deadParts = shopParts.filter((p: any) => {
      // ไม่เคยขาย/ใช้เลย ให้เทียบจากวันที่รับเข้าล่าสุด (หรือวันที่สร้างอะไหล่ ถ้าไม่มีประวัติรับเข้า) แทนการถือว่าตายทันที
      const baseline = lastMove[p.id] || lastReceived[p.id] || p.created_at;
      if (!baseline) return true;
      return new Date(baseline).getTime() < cutoff;
    });

    // ถึงรอบแล้ว เลื่อน last_sent_at เสมอ ไม่ว่าจะมีเดดสต็อคหรือไม่ (กันเช็คซ้ำทุกวัน)
    await admin.from('shops').update({ parts_dead_stock_last_sent_at: today }).eq('id', shopId);

    if (deadParts.length === 0) continue;
    deadStockTotal += deadParts.length;

    const sorted = [...deadParts].sort((a: any, b: any) => {
      const aBase = lastMove[a.id] || lastReceived[a.id] || a.created_at;
      const bBase = lastMove[b.id] || lastReceived[b.id] || b.created_at;
      return aBase.localeCompare(bBase);
    });

    const lines = sorted.slice(0, MAX_ITEMS_IN_MESSAGE).map((p: any) => {
      const baseline = lastMove[p.id] || lastReceived[p.id] || p.created_at;
      const overdueDays = daysSince(baseline, todayD);
      const receivedDate = (lastReceived[p.id] || p.created_at || '').slice(0, 10);
      const code = p.sku || p.id.slice(0, 8);
      const modelsTxt = (modelsByPart[p.id]?.join(' / ')) || 'ทั่วไป';
      const gradeTxt = p.grade ? (getGradeInfo(p.grade)?.label || p.grade) : '-';
      const value = Number(p.cost_price || 0) * Number(p.stock_qty || 0);
      return `🔧 ${p.name}\n🔖 ${code} • 📱 ${modelsTxt}\nคงเหลือ ${p.stock_qty} ชิ้น • เกรด ${gradeTxt}\nรับเข้าล่าสุด ${receivedDate} • ค้าง ${overdueDays} วัน\nต้นทุน ฿${Number(p.cost_price || 0).toLocaleString()} × ${p.stock_qty} = ฿${value.toLocaleString()}`;
    });

    const remaining = sorted.length - lines.length;
    const moreTxt = remaining > 0 ? `\n\n...และอีก ${remaining} รายการ` : '';
    const message = `📦 แจ้งเตือนเดดสต็อค (${sorted.length} รายการ)\nไม่มีการเคลื่อนไหวเกิน ${deadDays} วัน\n━━━━━━━━━━━━━\n${lines.join('\n━━━━━━━━━━━━━\n')}${moreTxt}`;

    const result = await sendShopLinePush(admin, shopId, message, 'dead_stock');
    if (result.sent) shopsNotified += 1;
  }

  return NextResponse.json({ success: true, dueShops: dueShopIds.length, shopsNotified, deadStockTotal });
}
