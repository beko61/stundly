-- Add problem and ergebnis fields to notdienst_entries
alter table public.notdienst_entries
  add column if not exists problem  text,
  add column if not exists ergebnis text;
