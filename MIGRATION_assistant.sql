-- LINE/Messenger AI assistant: เชื่อม Messenger + log คำถาม (ใช้เป็น audit trail และตัวนับ rate limit)
alter table public.profiles
  add column if not exists messenger_psid text,
  add column if not exists messenger_link_code text,
  add column if not exists messenger_link_code_expires_at timestamptz;

create table if not exists public.assistant_query_log (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id),
  platform text not null, -- 'line' | 'messenger'
  sender_key text not null, -- line_user_id หรือ messenger_psid
  question text not null,
  intent text,
  created_at timestamptz not null default now()
);

create index if not exists assistant_query_log_sender_idx on public.assistant_query_log(sender_key, created_at);
create index if not exists assistant_query_log_shop_idx on public.assistant_query_log(shop_id);

alter table public.assistant_query_log enable row level security;
drop policy if exists "assistant_query_log_shop_select" on public.assistant_query_log;
create policy "assistant_query_log_shop_select" on public.assistant_query_log for select using (
  shop_id in (select p.shop_id from public.profiles p where p.id = auth.uid())
);
