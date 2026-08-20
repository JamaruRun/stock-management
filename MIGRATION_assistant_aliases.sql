-- ให้แอดมิน "สอน" คำย่อ/ชื่อเล่นให้ AI assistant จำได้เอง ผ่าน LINE/Messenger (พิมพ์ "สอน <คำย่อ> = <ความหมาย>")
create table if not exists public.assistant_aliases (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id),
  alias text not null,
  expansion text not null,
  created_at timestamptz not null default now(),
  unique (shop_id, alias)
);

create index if not exists assistant_aliases_shop_idx on public.assistant_aliases(shop_id);

alter table public.assistant_aliases enable row level security;

drop policy if exists "assistant_aliases_shop_select" on public.assistant_aliases;
create policy "assistant_aliases_shop_select" on public.assistant_aliases for select using (
  shop_id in (select p.shop_id from public.profiles p where p.id = auth.uid())
);
