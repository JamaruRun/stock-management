-- Stock transfer workflow between branches.
-- Run this in Supabase SQL editor before using the transfer feature.

create table if not exists public.stock_transfers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  from_branch_id uuid not null references public.branches(id),
  to_branch_id uuid not null references public.branches(id),
  item_type text not null default 'stock' check (item_type in ('stock', 'parts', 'goods')),
  requested_by uuid references public.profiles(id),
  requested_by_name text,
  received_by uuid references public.profiles(id),
  received_by_name text,
  cancelled_by uuid references public.profiles(id),
  cancelled_by_name text,
  status text not null default 'pending' check (status in ('pending', 'received', 'cancelled')),
  stock_ids uuid[] not null default '{}',
  stock_items jsonb not null default '[]'::jsonb,
  item_count integer not null default 0,
  note text,
  created_at timestamptz not null default now(),
  received_at timestamptz,
  cancelled_at timestamptz
);

create index if not exists stock_transfers_shop_idx on public.stock_transfers(shop_id);
create index if not exists stock_transfers_status_idx on public.stock_transfers(status);
create index if not exists stock_transfers_to_branch_idx on public.stock_transfers(to_branch_id);
create index if not exists stock_transfers_from_branch_idx on public.stock_transfers(from_branch_id);
create index if not exists stock_transfers_created_at_idx on public.stock_transfers(created_at desc);

alter table public.stock_transfers enable row level security;

drop policy if exists "stock_transfers_select_shop_members" on public.stock_transfers;
create policy "stock_transfers_select_shop_members"
on public.stock_transfers for select
using (
  shop_id in (
    select p.shop_id
    from public.profiles p
    where p.id = auth.uid()
  )
);

-- Writes are performed by /api/stock-transfers using the service role after
-- validating branch ownership and user permissions.

-- If this table already exists from an older migration, run these safely too.
alter table public.stock_transfers
  add column if not exists item_type text not null default 'stock';

create index if not exists stock_transfers_item_type_idx on public.stock_transfers(item_type);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'stock_transfers_item_type_check'
  ) then
    alter table public.stock_transfers
      add constraint stock_transfers_item_type_check
      check (item_type in ('stock', 'parts', 'goods'));
  end if;
end $$;
