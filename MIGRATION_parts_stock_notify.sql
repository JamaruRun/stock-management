-- ตั้งค่าแจ้งเตือน LINE เดดสต็อค (รายรอบ ปรับวันได้ต่อร้าน) + toggle เปิด/ปิดแจ้งเตือนรับเข้า/ซ่อมด่วน
alter table public.shops
  add column if not exists parts_dead_stock_days integer not null default 90,
  add column if not exists parts_dead_stock_interval text not null default 'off',
  add column if not exists parts_dead_stock_last_sent_at date,
  add column if not exists line_notify_restock boolean not null default true,
  add column if not exists line_notify_repair_log boolean not null default true;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shops_parts_dead_stock_interval_check'
  ) then
    alter table public.shops
      add constraint shops_parts_dead_stock_interval_check
      check (parts_dead_stock_interval in ('off','weekly','monthly'));
  end if;
end $$;
