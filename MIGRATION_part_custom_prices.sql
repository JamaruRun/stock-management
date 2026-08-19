-- ราคาเพิ่มเติมแบบกำหนดหัวข้อเอง ต่ออะไหล่ 1 ชิ้น (เช่น "ราคาร้านสอง", "ราคาส่งเซ็นทรัล" ฯลฯ)
create table if not exists public.part_custom_prices (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.parts(id) on delete cascade,
  label text not null,
  price numeric not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists part_custom_prices_part_idx on public.part_custom_prices(part_id);

alter table public.part_custom_prices enable row level security;

drop policy if exists "part_custom_prices_shop_access" on public.part_custom_prices;
create policy "part_custom_prices_shop_access" on public.part_custom_prices for all using (
  part_id in (
    select pt.id from public.parts pt
    join public.profiles pr on pr.shop_id = pt.shop_id
    where pr.id = auth.uid()
  )
) with check (
  part_id in (
    select pt.id from public.parts pt
    join public.profiles pr on pr.shop_id = pt.shop_id
    where pr.id = auth.uid()
  )
);
