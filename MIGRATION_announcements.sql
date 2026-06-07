-- ============================================
-- StockCare 4.0 — ตาราง announcements (Broadcast)
-- รันใน Supabase → SQL Editor → New query → วาง → Run
-- ============================================

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  type text not null default 'info',            -- info | warning | success | promo
  is_active boolean not null default true,
  pinned boolean not null default false,
  expires_at timestamptz,                        -- หมดอายุอัตโนมัติ (null = ไม่หมด)
  created_by uuid references public.profiles(id),
  created_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists announcements_active_idx
  on public.announcements (is_active, created_at desc);

alter table public.announcements enable row level security;

-- ทุกคน (ที่ล็อกอิน) อ่านประกาศที่ active ได้ / super admin เห็นทั้งหมด
drop policy if exists "read announcements" on public.announcements;
create policy "read announcements" on public.announcements
  for select
  using (is_active = true or public.is_super_admin());

-- เฉพาะ super admin เท่านั้นที่สร้าง/แก้/ลบได้
drop policy if exists "manage announcements" on public.announcements;
create policy "manage announcements" on public.announcements
  for all
  using (public.is_super_admin())
  with check (public.is_super_admin());
