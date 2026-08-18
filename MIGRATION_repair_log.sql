-- ระบบซ่อมด่วนในหน้าอะไหล่ (v3) ไม่ผ่านใบงาน repair_jobs — ตัดสต็อคตรง + บันทึกแยกไว้เชื่อมระบบรายรับ-รายจ่ายในอนาคต
create table if not exists public.repair_log (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id),
  branch_id uuid,
  device_model text not null,
  price_type text not null default 'retail', -- 'retail' (หน้าร้าน) | 'wholesale' (ส่ง)
  labor_cost numeric not null default 0,
  parts_total numeric not null default 0, -- Σ unit_price × qty ก่อนหักส่วนลด
  discount numeric not null default 0,
  total numeric not null default 0, -- parts_total + labor_cost - discount
  done_by uuid,
  done_by_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.repair_log_parts (
  id uuid primary key default gen_random_uuid(),
  repair_log_id uuid not null references public.repair_log(id) on delete cascade,
  part_id uuid references public.parts(id),
  part_name text not null,
  qty integer not null,
  unit_cost numeric not null default 0,   -- ต้นทุนจริง (parts.cost_price ตอนบันทึก) เก็บไว้คำนวณกำไร/เชื่อมรายรับ-รายจ่ายทีหลัง
  unit_price numeric not null default 0   -- ราคาที่คิดจริง (sell_price หรือ wholesale_price ตาม price_type)
);

create index if not exists repair_log_shop_idx on public.repair_log(shop_id);
create index if not exists repair_log_parts_log_idx on public.repair_log_parts(repair_log_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'repair_log_price_type_check'
  ) then
    alter table public.repair_log
      add constraint repair_log_price_type_check
      check (price_type in ('retail','wholesale'));
  end if;
end $$;

alter table public.repair_log enable row level security;
alter table public.repair_log_parts enable row level security;

drop policy if exists "repair_log_shop_select" on public.repair_log;
create policy "repair_log_shop_select" on public.repair_log for select using (
  shop_id in (select p.shop_id from public.profiles p where p.id = auth.uid())
);
drop policy if exists "repair_log_shop_write" on public.repair_log;
create policy "repair_log_shop_write" on public.repair_log for all using (
  shop_id in (select p.shop_id from public.profiles p where p.id = auth.uid())
) with check (
  shop_id in (select p.shop_id from public.profiles p where p.id = auth.uid())
);

drop policy if exists "repair_log_parts_select" on public.repair_log_parts;
create policy "repair_log_parts_select" on public.repair_log_parts for select using (
  repair_log_id in (select id from public.repair_log where shop_id in (select p.shop_id from public.profiles p where p.id = auth.uid()))
);
drop policy if exists "repair_log_parts_write" on public.repair_log_parts;
create policy "repair_log_parts_write" on public.repair_log_parts for all using (
  repair_log_id in (select id from public.repair_log where shop_id in (select p.shop_id from public.profiles p where p.id = auth.uid()))
) with check (
  repair_log_id in (select id from public.repair_log where shop_id in (select p.shop_id from public.profiles p where p.id = auth.uid()))
);
