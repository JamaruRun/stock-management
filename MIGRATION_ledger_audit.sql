-- Audit log สำหรับการแก้ไข/ลบ ledger_entries (และตารางอื่นในอนาคต ผ่าน table_name)
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  table_name text not null,
  record_id uuid not null,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  changed_by uuid,
  changed_by_name text,
  changed_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'audit_log_action_check') then
    alter table public.audit_log add constraint audit_log_action_check check (action in ('update','delete'));
  end if;
end $$;

create index if not exists audit_log_shop_idx on public.audit_log(shop_id);
create index if not exists audit_log_record_idx on public.audit_log(table_name, record_id);

alter table public.audit_log enable row level security;
drop policy if exists "audit_log_shop_select" on public.audit_log;
create policy "audit_log_shop_select" on public.audit_log for select using (
  shop_id in (select p.shop_id from public.profiles p where p.id = auth.uid())
);
drop policy if exists "audit_log_shop_insert" on public.audit_log;
create policy "audit_log_shop_insert" on public.audit_log for insert with check (
  shop_id in (select p.shop_id from public.profiles p where p.id = auth.uid())
);
