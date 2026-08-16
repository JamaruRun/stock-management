-- Pawn module: support pattern-lock (drawn dot pattern) as an alternative to text password/PIN.
-- Run this in Supabase SQL editor.

alter table public.pawn_stock
  add column if not exists device_lock_type text not null default 'password';
alter table public.pawn_history
  add column if not exists device_lock_type text not null default 'password';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pawn_stock_lock_type_check') then
    alter table public.pawn_stock add constraint pawn_stock_lock_type_check check (device_lock_type in ('password','pattern'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pawn_history_lock_type_check') then
    alter table public.pawn_history add constraint pawn_history_lock_type_check check (device_lock_type in ('password','pattern'));
  end if;
end $$;
