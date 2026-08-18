import { computeBusinessDate } from '@/lib/business-date';

export const DEFAULT_SYNC_RULES: { source_event: string; entry_type: 'income' | 'expense' | 'none'; enabled: boolean; label: string }[] = [
  { source_event: 'pawn_add', entry_type: 'expense', enabled: true, label: 'รับจำนำเครื่องใหม่' },
  { source_event: 'pawn_interest', entry_type: 'income', enabled: true, label: 'เก็บดอกเบี้ยจำนำ (ต่อดอก)' },
  { source_event: 'parts_sold', entry_type: 'income', enabled: true, label: 'ขายอะไหล่' },
  { source_event: 'parts_repair_used', entry_type: 'income', enabled: true, label: 'ซ่อมด่วน (อะไหล่+ค่าแรง)' },
  { source_event: 'parts_stock_in', entry_type: 'none', enabled: false, label: 'รับอะไหล่เข้าสต็อค' },
];

async function ensureSyncRules(supabase: any, shopId: string) {
  const { data } = await supabase.from('ledger_sync_rules').select('*').eq('shop_id', shopId);
  if (data && data.length > 0) return data;
  await supabase.from('ledger_sync_rules').insert(
    DEFAULT_SYNC_RULES.map((r) => ({ shop_id: shopId, ...r }))
  );
  const { data: seeded } = await supabase.from('ledger_sync_rules').select('*').eq('shop_id', shopId);
  return seeded || [];
}

interface SyncParams {
  shopId: string;
  branchId?: string | null;
  sourceEvent: string;
  amount: number;
  description: string;
  userId?: string | null;
  userName?: string | null;
  timestamp?: string | Date;
}

/** เรียกหลังบันทึกเหตุการณ์จริงสำเร็จ (จำนำใหม่/ต่อดอก/ขายอะไหล่/ซ่อมด่วน ฯลฯ) — เช็ค sync rule ของร้านนั้น
 * แล้ว insert ledger_entries อัตโนมัติถ้าเปิดใช้งานอยู่ ไม่ throw error เพื่อไม่ให้กระทบ flow หลัก */
export async function syncLedgerEntry(supabase: any, params: SyncParams) {
  try {
    const rules = await ensureSyncRules(supabase, params.shopId);
    const rule = rules.find((r: any) => r.source_event === params.sourceEvent);
    if (!rule || !rule.enabled || rule.entry_type === 'none') return;

    const { data: shop } = await supabase.from('shops').select('daily_cutoff_time').eq('id', params.shopId).single();
    const cutoff = shop?.daily_cutoff_time || '00:00';
    const ts = params.timestamp || new Date();
    const businessDate = computeBusinessDate(ts, cutoff);

    await supabase.from('ledger_entries').insert({
      shop_id: params.shopId,
      branch_id: params.branchId || null,
      business_date: businessDate,
      description: params.description,
      entry_type: rule.entry_type,
      amount: params.amount,
      is_auto_synced: true,
      source_event: params.sourceEvent,
      created_by: params.userId || null,
      created_by_name: params.userName || null,
    });
  } catch (e) {
    console.error('syncLedgerEntry error:', e);
  }
}

export async function updateLedgerEntryWithAudit(supabase: any, id: string, changes: Record<string, any>, userId: string, userName: string) {
  const { data: oldRow } = await supabase.from('ledger_entries').select('*').eq('id', id).single();
  if (!oldRow) return { error: 'not found' };

  const { error } = await supabase.from('ledger_entries').update({ ...changes, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return { error: error.message };

  await supabase.from('audit_log').insert({
    shop_id: oldRow.shop_id, table_name: 'ledger_entries', record_id: id, action: 'update',
    old_value: oldRow, new_value: { ...oldRow, ...changes },
    changed_by: userId, changed_by_name: userName,
  });
  return { error: null };
}

export async function deleteLedgerEntryWithAudit(supabase: any, id: string, userId: string, userName: string) {
  const { data: oldRow } = await supabase.from('ledger_entries').select('*').eq('id', id).single();
  if (!oldRow) return { error: 'not found' };

  const deletedAt = new Date().toISOString();
  const { error } = await supabase.from('ledger_entries').update({ deleted_at: deletedAt }).eq('id', id);
  if (error) return { error: error.message };

  await supabase.from('audit_log').insert({
    shop_id: oldRow.shop_id, table_name: 'ledger_entries', record_id: id, action: 'delete',
    old_value: oldRow, new_value: { ...oldRow, deleted_at: deletedAt },
    changed_by: userId, changed_by_name: userName,
  });
  return { error: null };
}
