-- ให้ช่องทางชำระของสมุดรายรับ-รายจ่ายพิมพ์เองได้อิสระ (เช่น "เช็ค", "พร้อมเพย์") ไม่บังคับแค่ cash/transfer
alter table public.ledger_entries drop constraint if exists ledger_entries_payment_method_check;
