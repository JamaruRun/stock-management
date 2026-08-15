import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendShopLinePush } from '@/lib/line-push-server';

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

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function daysSince(dateStr: string, todayD: Date) {
  const d = new Date(dateStr);
  return Math.floor((todayD.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function itemLine(item: any) {
  const due = new Date(item.due_date);
  const now = new Date();
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const dueTxt = diffDays < 0 ? `เลยกำหนดมาแล้ว ${-diffDays} วัน` : `อีก ${diffDays} วัน`;
  return `• ${item.model} • ${item.customer_name}${item.customer_phone ? ` • 📞 ${item.customer_phone}` : ''} • ครบ ${item.due_date} (${dueTxt})`;
}

const SUMMARY_LABEL: Record<string, string> = {
  daily: 'รายวัน',
  weekly: 'รายสัปดาห์',
  monthly: 'รายเดือน',
};

const MIN_DAYS_FOR_INTERVAL: Record<string, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
};

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
  const in3days = addDays(today, 3);

  const { data: shops } = await admin
    .from('shops')
    .select('id, pawn_forfeit_after_cycles, pawn_summary_interval, pawn_summary_last_sent_at');
  const shopMap: Record<string, any> = Object.fromEntries((shops || []).map((s: any) => [s.id, s]));

  // ===== ใกล้ครบกำหนด / เลยกำหนด (เดิม) =====
  const { data: dueSoon } = await admin
    .from('pawn_stock')
    .select('*')
    .neq('status', 'forfeited')
    .is('reminder_due_sent_at', null)
    .gte('due_date', today)
    .lte('due_date', in3days);

  const { data: overdue } = await admin
    .from('pawn_stock')
    .select('*')
    .neq('status', 'forfeited')
    .is('reminder_overdue_sent_at', null)
    .lt('due_date', today);

  const byShop: Record<string, { dueSoon: any[]; overdue: any[] }> = {};
  for (const item of dueSoon || []) {
    if (!item.shop_id) continue;
    (byShop[item.shop_id] ||= { dueSoon: [], overdue: [] }).dueSoon.push(item);
  }
  for (const item of overdue || []) {
    if (!item.shop_id) continue;
    (byShop[item.shop_id] ||= { dueSoon: [], overdue: [] }).overdue.push(item);
  }

  let shopsNotified = 0;
  for (const [shopId, group] of Object.entries(byShop)) {
    const sections: string[] = [];
    if (group.dueSoon.length > 0) {
      sections.push(`⏰ ใกล้ครบกำหนดจำนำ (${group.dueSoon.length} รายการ)\n━━━━━━━━━━━━━\n${group.dueSoon.map(itemLine).join('\n')}`);
    }
    if (group.overdue.length > 0) {
      sections.push(`🔴 เลยกำหนดจำนำ (${group.overdue.length} รายการ)\n━━━━━━━━━━━━━\n${group.overdue.map(itemLine).join('\n')}`);
    }
    if (sections.length === 0) continue;

    const result = await sendShopLinePush(admin, shopId, sections.join('\n\n'), 'pawn');
    if (result.sent) shopsNotified += 1;

    const dueSoonIds = group.dueSoon.map((i) => i.id);
    const overdueIds = group.overdue.map((i) => i.id);
    if (dueSoonIds.length > 0) {
      await admin.from('pawn_stock').update({ reminder_due_sent_at: today }).in('id', dueSoonIds);
    }
    if (overdueIds.length > 0) {
      await admin.from('pawn_stock').update({ reminder_overdue_sent_at: today }).in('id', overdueIds);
    }
  }

  // ===== เลยกำหนดหลุดจำนำ (เกิน N งวด ตามที่ร้านตั้งไว้) =====
  const { data: forfeitCandidates } = await admin
    .from('pawn_stock')
    .select('*')
    .neq('status', 'forfeited')
    .is('forfeit_alert_sent_at', null)
    .not('due_date', 'is', null);

  const forfeitEligible = (forfeitCandidates || []).filter((item: any) => {
    const shop = shopMap[item.shop_id];
    const cycles = shop?.pawn_forfeit_after_cycles ?? 3;
    const thresholdDate = addDays(item.due_date, cycles * (item.interest_days || 30));
    return thresholdDate <= today;
  });

  let forfeitAlertsSent = 0;
  if (forfeitEligible.length > 0) {
    const ids = forfeitEligible.map((i: any) => i.id);
    const { data: renewalRows } = await admin
      .from('pawn_renewals')
      .select('pawn_id, interest_paid')
      .in('pawn_id', ids);

    const interestByPawnId: Record<string, number> = {};
    for (const r of renewalRows || []) {
      interestByPawnId[r.pawn_id] = (interestByPawnId[r.pawn_id] || 0) + Number(r.interest_paid || 0);
    }

    const byShopForfeit: Record<string, any[]> = {};
    for (const item of forfeitEligible) {
      if (!item.shop_id) continue;
      (byShopForfeit[item.shop_id] ||= []).push(item);
    }

    for (const [shopId, items] of Object.entries(byShopForfeit)) {
      const cycles = shopMap[shopId]?.pawn_forfeit_after_cycles ?? 3;
      const lines = items.map((item: any) => {
        const totalInterest = interestByPawnId[item.id] || 0;
        const overdueDays = daysSince(item.due_date, todayD);
        return `• ${item.model} • ${item.customer_name} • เงินต้น ฿${Number(item.pawn_price).toLocaleString()} • ดอกที่เก็บแล้ว ฿${totalInterest.toLocaleString()} • เลยกำหนด ${overdueDays} วัน (เกิน ${cycles} งวด)`;
      });
      const message = `🚨 เครื่องเลยกำหนดหลุดจำนำ (${items.length} รายการ)\n━━━━━━━━━━━━━\n${lines.join('\n')}\n━━━━━━━━━━━━━\nกรุณาตรวจสอบและกดยืนยัน "บันทึกหลุดจำนำ" ในระบบ`;

      const result = await sendShopLinePush(admin, shopId, message, 'pawn');
      if (result.sent) forfeitAlertsSent += 1;

      await admin.from('pawn_stock').update({ forfeit_alert_sent_at: today }).in('id', items.map((i: any) => i.id));
    }
  }

  // ===== สรุปยอดรับจำนำเป็นรอบ =====
  let summariesSent = 0;
  for (const shop of shops || []) {
    const interval = shop.pawn_summary_interval;
    if (!interval || interval === 'off') continue;

    const lastSent = shop.pawn_summary_last_sent_at;
    if (!lastSent) {
      // ยังไม่เคยส่ง - ตั้ง baseline วันนี้ก่อน ยังไม่ส่งรอบแรก (ไม่มีช่วงเวลาอ้างอิงให้สรุป)
      await admin.from('shops').update({ pawn_summary_last_sent_at: today }).eq('id', shop.id);
      continue;
    }

    const elapsed = daysSince(lastSent, todayD);
    const minDays = MIN_DAYS_FOR_INTERVAL[interval];
    if (!minDays || elapsed < minDays) continue;

    const periodStart = lastSent;

    const [{ data: activeNew }, { data: exitedNew }, { data: renewals }, { data: history }] = await Promise.all([
      admin.from('pawn_stock').select('pawn_price').eq('shop_id', shop.id).gt('pawn_date', periodStart).lte('pawn_date', today),
      admin.from('pawn_history').select('pawn_price').eq('shop_id', shop.id).gt('pawn_date', periodStart).lte('pawn_date', today),
      admin.from('pawn_renewals').select('interest_paid').eq('shop_id', shop.id).gt('renewal_date', periodStart).lte('renewal_date', today),
      admin.from('pawn_history').select('pawn_price, exit_status').eq('shop_id', shop.id).gt('redeem_date', periodStart).lte('redeem_date', today),
    ]);

    const newCount = (activeNew?.length || 0) + (exitedNew?.length || 0);
    const newCost = [...(activeNew || []), ...(exitedNew || [])].reduce((s, r) => s + Number(r.pawn_price || 0), 0);
    const renewCount = (renewals || []).length;
    const renewInterest = (renewals || []).reduce((s, r) => s + Number(r.interest_paid || 0), 0);
    const redeemedRows = (history || []).filter((h) => h.exit_status === 'redeemed');
    const forfeitedRows = (history || []).filter((h) => h.exit_status === 'forfeited');
    const redeemedValue = redeemedRows.reduce((s, r) => s + Number(r.pawn_price || 0), 0);
    const forfeitedValue = forfeitedRows.reduce((s, r) => s + Number(r.pawn_price || 0), 0);

    const message = [
      `📊 สรุปยอดจำนำ (${SUMMARY_LABEL[interval] || interval})`,
      '━━━━━━━━━━━━━',
      `📥 รับจำนำใหม่: ${newCount} เครื่อง (฿${newCost.toLocaleString()})`,
      `🔄 ต่อดอก: ${renewCount} ครั้ง (ดอกรวม ฿${renewInterest.toLocaleString()})`,
      `🔓 ไถ่คืน: ${redeemedRows.length} เครื่อง (฿${redeemedValue.toLocaleString()})`,
      `⚫ หลุดจำนำ: ${forfeitedRows.length} เครื่อง (฿${forfeitedValue.toLocaleString()})`,
      '━━━━━━━━━━━━━',
      `ช่วง ${periodStart} - ${today}`,
    ].join('\n');

    const result = await sendShopLinePush(admin, shop.id, message, 'pawn');
    if (result.sent) summariesSent += 1;

    await admin.from('shops').update({ pawn_summary_last_sent_at: today }).eq('id', shop.id);
  }

  return NextResponse.json({
    success: true,
    dueSoonCount: (dueSoon || []).length,
    overdueCount: (overdue || []).length,
    shopsNotified,
    forfeitEligibleCount: forfeitEligible.length,
    forfeitAlertsSent,
    summariesSent,
  });
}
