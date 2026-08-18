-- ระบบรายรับ-รายจ่าย (StockCare Ledger): วันบัญชี (business_date) + สมุดบันทึกอิสระ + sync rules
alter table public.shops
  add column if not exists daily_cutoff_time time not null default '00:00',
  add column if not exists ledger_cutoff_last_notified_date date,
  add column if not exists line_notify_ledger_cutoff boolean not null default true;

-- เพิ่ม business_date แบบ stored ให้ sales_history/goods_sales ด้วย (ไม่ใช่แค่ ledger_entries)
-- เพื่อไม่ให้ต้องคำนวณสดตอน query ด้วย cutoff ปัจจุบัน ซึ่งจะทำให้รายการเก่าเพี้ยนย้อนหลังถ้าร้านเคยเปลี่ยน cutoff
alter table public.sales_history add column if not exists business_date date;
alter table public.goods_sales add column if not exists business_date date;

-- backfill ข้อมูลเก่า (best-effort ครั้งเดียว ใช้ cutoff ปัจจุบันของแต่ละร้าน ณ ตอน migrate)
update public.sales_history sh
set business_date = (
  case
    when s.daily_cutoff_time = '00:00'::time then sh.sold_date::date
    when (sh.sold_date::timestamptz)::time >= s.daily_cutoff_time then (sh.sold_date::date + interval '1 day')::date
    else sh.sold_date::date
  end
)
from public.shops s
where s.id = sh.shop_id and sh.business_date is null and sh.sold_date is not null;

update public.goods_sales gs
set business_date = (
  case
    when s.daily_cutoff_time = '00:00'::time then gs.sold_date::date
    when (gs.sold_date::timestamptz)::time >= s.daily_cutoff_time then (gs.sold_date::date + interval '1 day')::date
    else gs.sold_date::date
  end
)
from public.shops s
where s.id = gs.shop_id and gs.business_date is null and gs.sold_date is not null;

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id),
  branch_id uuid,
  business_date date not null,
  description text not null,
  entry_type text not null,
  amount numeric not null,
  payment_method text,
  is_auto_synced boolean not null default false,
  source_event text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ledger_entries_entry_type_check') then
    alter table public.ledger_entries add constraint ledger_entries_entry_type_check check (entry_type in ('income','expense'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ledger_entries_payment_method_check') then
    alter table public.ledger_entries add constraint ledger_entries_payment_method_check check (payment_method is null or payment_method in ('cash','transfer'));
  end if;
end $$;

create index if not exists ledger_entries_shop_date_idx on public.ledger_entries(shop_id, business_date);

alter table public.ledger_entries enable row level security;
drop policy if exists "ledger_entries_shop_select" on public.ledger_entries;
create policy "ledger_entries_shop_select" on public.ledger_entries for select using (
  shop_id in (select p.shop_id from public.profiles p where p.id = auth.uid())
);
drop policy if exists "ledger_entries_shop_write" on public.ledger_entries;
create policy "ledger_entries_shop_write" on public.ledger_entries for all using (
  shop_id in (select p.shop_id from public.profiles p where p.id = auth.uid())
) with check (
  shop_id in (select p.shop_id from public.profiles p where p.id = auth.uid())
);

create table if not exists public.ledger_sync_rules (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id),
  source_event text not null,
  entry_type text not null default 'none',
  enabled boolean not null default false,
  label text not null,
  unique (shop_id, source_event)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ledger_sync_rules_entry_type_check') then
    alter table public.ledger_sync_rules add constraint ledger_sync_rules_entry_type_check check (entry_type in ('income','expense','none'));
  end if;
end $$;

alter table public.ledger_sync_rules enable row level security;
drop policy if exists "ledger_sync_rules_shop_select" on public.ledger_sync_rules;
create policy "ledger_sync_rules_shop_select" on public.ledger_sync_rules for select using (
  shop_id in (select p.shop_id from public.profiles p where p.id = auth.uid())
);
drop policy if exists "ledger_sync_rules_shop_write" on public.ledger_sync_rules;
create policy "ledger_sync_rules_shop_write" on public.ledger_sync_rules for all using (
  shop_id in (select p.shop_id from public.profiles p where p.id = auth.uid())
) with check (
  shop_id in (select p.shop_id from public.profiles p where p.id = auth.uid())
);

-- seed default sync rules ให้ทุกร้านที่มีอยู่แล้ว (ร้านใหม่ในอนาคตจะถูก lazy-seed จากโค้ดแอปตอนใช้งานจริง)
insert into public.ledger_sync_rules (shop_id, source_event, entry_type, enabled, label)
select id, 'pawn_add', 'expense', true, 'รับจำนำเครื่องใหม่' from public.shops
on conflict (shop_id, source_event) do nothing;

insert into public.ledger_sync_rules (shop_id, source_event, entry_type, enabled, label)
select id, 'pawn_interest', 'income', true, 'เก็บดอกเบี้ยจำนำ (ต่อดอก)' from public.shops
on conflict (shop_id, source_event) do nothing;

insert into public.ledger_sync_rules (shop_id, source_event, entry_type, enabled, label)
select id, 'parts_sold', 'income', true, 'ขายอะไหล่' from public.shops
on conflict (shop_id, source_event) do nothing;

insert into public.ledger_sync_rules (shop_id, source_event, entry_type, enabled, label)
select id, 'parts_repair_used', 'income', true, 'ซ่อมด่วน (อะไหล่+ค่าแรง)' from public.shops
on conflict (shop_id, source_event) do nothing;

insert into public.ledger_sync_rules (shop_id, source_event, entry_type, enabled, label)
select id, 'parts_stock_in', 'none', false, 'รับอะไหล่เข้าสต็อค' from public.shops
on conflict (shop_id, source_event) do nothing;
