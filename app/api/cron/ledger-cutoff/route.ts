import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendShopLinePush } from '@/lib/line-push-server';
import { computeBusinessDate } from '@/lib/business-date';

function adminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const THAI_OFFSET_MS = 7 * 60 * 60 * 1000;

function thaiNowParts() {
  const thai = new Date(Date.now() + THAI_OFFSET_MS);
  const dateStr = `${thai.getUTCFullYear()}-${String(thai.getUTCMonth() + 1).padStart(2, '0')}-${String(thai.getUTCDate()).padStart(2, '0')}`;
  const minutesOfDay = thai.getUTCHours() * 60 + thai.getUTCMinutes();
  return { dateStr, minutesOfDay };
}

// รันทุก 15 นาที ผ่าน vercel.json — เช็คว่าร้านไหนถึงเวลา cutoff ของตัวเองแล้วบ้าง (แต่ละร้านตั้งเวลาไม่เท่ากัน)
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const admin = adminClient();
  const { dateStr: todayThai, minutesOfDay: nowMinutes } = thaiNowParts();

  const { data: shops } = await admin
    .from('shops')
    .select('id, daily_cutoff_time, ledger_cutoff_last_notified_date');

  let notified = 0;
  let inWindowCount = 0;

  for (const shop of shops || []) {
    const cutoff = shop.daily_cutoff_time || '00:00';
    const [ch, cm] = cutoff.split(':').map((n: string) => parseInt(n, 10) || 0);
    const cutoffMinutes = ch * 60 + cm;

    const inWindow = nowMinutes >= cutoffMinutes && nowMinutes < cutoffMinutes + 15;
    if (!inWindow) continue;
    inWindowCount += 1;
    if (shop.ledger_cutoff_last_notified_date === todayThai) continue; // ยิงไปแล้วรอบนี้ กันซ้ำ

    // วันบัญชีที่เพิ่งปิดรอบ = business date ของเวลาปัจจุบัน (ลบ 1 นาทีกันตกขอบพอดี cutoff)
    const closedBusinessDate = computeBusinessDate(new Date(Date.now() - 60000), cutoff);

    const [{ data: entries }, { data: sales }, { data: goods }] = await Promise.all([
      admin.from('ledger_entries').select('entry_type, amount').eq('shop_id', shop.id).eq('business_date', closedBusinessDate).is('deleted_at', null),
      admin.from('sales_history').select('profit').eq('shop_id', shop.id).eq('business_date', closedBusinessDate),
      admin.from('goods_sales').select('subtotal').eq('shop_id', shop.id).eq('business_date', closedBusinessDate),
    ]);

    const ledgerIncome = (entries || []).filter((e: any) => e.entry_type === 'income').reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
    const ledgerExpense = (entries || []).filter((e: any) => e.entry_type === 'expense').reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
    const salesProfit = (sales || []).reduce((s: number, r: any) => s + Number(r.profit || 0), 0);
    const goodsRevenue = (goods || []).reduce((s: number, r: any) => s + Number(r.subtotal || 0), 0);
    const totalIncome = ledgerIncome + salesProfit + goodsRevenue;
    const totalExpense = ledgerExpense;
    const netProfit = totalIncome - totalExpense;
    const itemCount = (entries || []).length + (sales || []).length + (goods || []).length;

    const message = [
      `📊 สรุปวันบัญชี ${closedBusinessDate}`,
      '━━━━━━━━━━━━━',
      `💰 รายรับรวม: ฿${totalIncome.toLocaleString()}`,
      `💸 รายจ่ายรวม: ฿${totalExpense.toLocaleString()}`,
      `📈 กำไรสุทธิ: ฿${netProfit.toLocaleString()}`,
      `🧾 รายการทั้งหมด: ${itemCount} รายการ`,
      '━━━━━━━━━━━━━',
      'วันบัญชีใหม่เริ่มนับต่อแล้ว',
    ].join('\n');

    const result = await sendShopLinePush(admin, shop.id, message, 'ledger_cutoff');
    if (result.sent) notified += 1;

    await admin.from('shops').update({ ledger_cutoff_last_notified_date: todayThai }).eq('id', shop.id);
  }

  return NextResponse.json({ success: true, inWindowCount, notified });
}
