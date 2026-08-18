import type { SupabaseClient } from '@supabase/supabase-js';

const TYPE_TOGGLE_MAP: Record<string, string> = {
  sale: 'line_notify_sale',
  pawn: 'line_notify_pawn',
  goods: 'line_notify_goods',
  installment: 'line_notify_installment',
  low_stock: 'line_notify_low_stock',
  parts_low: 'line_notify_parts_low',
  restock: 'line_notify_restock',
  repair_log: 'line_notify_repair_log',
};

/**
 * Server-side LINE push, for use where there's no request cookie session (e.g. cron jobs).
 * If the shop has a LINE group connected, send there ONLY (saves messaging quota - a group
 * push counts once instead of once per admin). Falls back to pushing each connected admin's
 * private chat only when there's no group, or the group push itself fails.
 */
export async function sendShopLinePush(admin: SupabaseClient, shopId: string, message: string, type: string) {
  const channelToken = process.env.LINE_MESSAGING_CHANNEL_TOKEN;
  if (!channelToken) return { sent: false, reason: 'LINE_MESSAGING_CHANNEL_TOKEN not configured' };

  const { data: shop } = await admin.from('shops').select('*').eq('id', shopId).single();
  if (!shop) return { sent: false, reason: 'shop not found' };

  const toggleKey = TYPE_TOGGLE_MAP[type];
  if (toggleKey && !shop[toggleKey]) return { sent: false, reason: `${type} notify off` };

  async function push(to: string) {
    const target = String(to || '').trim();
    if (!target) return false;
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { Authorization: `Bearer ${channelToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: target, messages: [{ type: 'text', text: message }] }),
    });
    if (!res.ok) {
      console.error(`LINE push failed (${target.slice(0, 4)}...):`, await res.text());
      return false;
    }
    return true;
  }

  if (shop.line_group_id) {
    const sent = await push(shop.line_group_id);
    if (sent) return { sent: true, target: 'group' };
  }

  const { data: admins } = await admin
    .from('profiles')
    .select('line_user_id, role, is_super_admin')
    .eq('shop_id', shopId)
    .not('line_user_id', 'is', null);

  const adminTargets = Array.from(new Set((admins || [])
    .filter((p: any) => p.role === 'admin' || p.is_super_admin)
    .map((p: any) => p.line_user_id)
    .filter(Boolean)));

  const results = await Promise.allSettled(adminTargets.map((id: string) => push(id)));
  const sentCount = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;

  return { sent: sentCount > 0, target: 'individuals', sentTo: sentCount };
}
