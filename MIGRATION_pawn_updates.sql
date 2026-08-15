-- Pawn module updates: device password, reminder tracking, IMEI now optional.
-- Run this in Supabase SQL editor.

alter table public.pawn_stock
  add column if not exists device_password text,
  add column if not exists reminder_due_sent_at date,
  add column if not exists reminder_overdue_sent_at date;

alter table public.pawn_stock alter column imei drop not null;

alter table public.pawn_history
  add column if not exists device_password text;
