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

function itemLine(item: any) {
  const due = new Date(item.due_date);
  const now = new Date();
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const dueTxt = diffDays < 0 ? `เลยกำหนดมาแล้ว ${-diffDays} วัน` : `อีก ${diffDays} วัน`;
  return `• ${item.model} • ${item.customer_name}${item.customer_phone ? ` • 📞 ${item.customer_phone}` : ''} • ครบ ${item.due_date} (${dueTxt})`;
}

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
  const in3days = addDays(today, 3);

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

  return NextResponse.json({
    success: true,
    dueSoonCount: (dueSoon || []).length,
    overdueCount: (overdue || []).length,
    shopsNotified,
  });
}
