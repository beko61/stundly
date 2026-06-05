-- Add Mitarbeiter fields to profiles table
alter table public.profiles
  add column if not exists vorname           text,
  add column if not exists nachname          text,
  add column if not exists personal_nr       text,
  add column if not exists eintrittsdatum    text,
  add column if not exists abteilung         text,
  add column if not exists vorgesetzter      text,
  add column if not exists email             text,
  add column if not exists signature_data    text;  -- base64 PNG of saved signature
