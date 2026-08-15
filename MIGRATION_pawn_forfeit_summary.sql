-- Pawn module: forfeit-eligible alert + periodic summary report settings.
-- Run this in Supabase SQL editor.

alter table public.pawn_stock
  add column if not exists forfeit_alert_sent_at date;

alter table public.shops
  add column if not exists pawn_forfeit_after_cycles integer not null default 3,
  add column if not exists pawn_summary_interval text not null default 'off',
  add column if not exists pawn_summary_last_sent_at date;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shops_pawn_summary_interval_check'
  ) then
    alter table public.shops
      add constraint shops_pawn_summary_interval_check
      check (pawn_summary_interval in ('off','daily','weekly','monthly'));
  end if;
end $$;
