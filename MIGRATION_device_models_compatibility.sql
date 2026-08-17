-- Parts many-to-many model compatibility: device_models (global catalog) + part_compatibility
-- (per part-model pricing: cost/labor/sell). Run this in Supabase SQL editor.
--
-- parts.phone_model / parts.cost_price / parts.sell_price are kept as legacy/fallback columns
-- (synced to the first compatibility row on every save) - do NOT drop them in this pass.

create table if not exists public.device_models (
  id uuid primary key default gen_random_uuid(),
  brand text,
  model_name text not null,
  created_at timestamptz not null default now(),
  unique (model_name)
);

create table if not exists public.part_compatibility (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.parts(id) on delete cascade,
  device_model_id uuid not null references public.device_models(id) on delete cascade,
  cost_price numeric not null default 0,
  labor_cost numeric not null default 0,
  sell_price numeric not null default 0,
  note text,
  created_at timestamptz not null default now(),
  unique (part_id, device_model_id)
);

create index if not exists part_compat_part_idx on public.part_compatibility(part_id);
create index if not exists part_compat_model_idx on public.part_compatibility(device_model_id);

alter table public.device_models enable row level security;
alter table public.part_compatibility enable row level security;

-- device_models: global catalog shared by every shop - any logged-in user can read/add to it.
drop policy if exists "device_models_select_all" on public.device_models;
create policy "device_models_select_all"
on public.device_models for select
using (auth.uid() is not null);

drop policy if exists "device_models_insert_all" on public.device_models;
create policy "device_models_insert_all"
on public.device_models for insert
with check (auth.uid() is not null);

-- part_compatibility: scoped through parts.shop_id so shops never see/write each other's pairs.
drop policy if exists "part_compat_select_shop" on public.part_compatibility;
create policy "part_compat_select_shop"
on public.part_compatibility for select
using (
  part_id in (
    select p.id from public.parts p
    where p.shop_id in (select pr.shop_id from public.profiles pr where pr.id = auth.uid())
  )
);

drop policy if exists "part_compat_write_shop" on public.part_compatibility;
create policy "part_compat_write_shop"
on public.part_compatibility for all
using (
  part_id in (
    select p.id from public.parts p
    where p.shop_id in (select pr.shop_id from public.profiles pr where pr.id = auth.uid())
  )
)
with check (
  part_id in (
    select p.id from public.parts p
    where p.shop_id in (select pr.shop_id from public.profiles pr where pr.id = auth.uid())
  )
);

-- Seed from existing 1:1 data. Same model name across different shops dedupes into one
-- device_models row (intentional - it's a shared catalog).
insert into public.device_models (model_name)
select distinct phone_model from public.parts
where phone_model is not null and trim(phone_model) <> ''
on conflict (model_name) do nothing;

insert into public.part_compatibility (part_id, device_model_id, cost_price, labor_cost, sell_price)
select p.id, dm.id, coalesce(p.cost_price, 0), 0, coalesce(p.sell_price, 0)
from public.parts p
join public.device_models dm on dm.model_name = p.phone_model
where p.phone_model is not null and trim(p.phone_model) <> ''
on conflict (part_id, device_model_id) do nothing;
