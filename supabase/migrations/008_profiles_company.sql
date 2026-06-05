-- Add company and regional fields to profiles
alter table public.profiles
  add column if not exists company_name text,
  add column if not exists logo_data    text,       -- base64 PNG/JPEG of company logo
  add column if not exists bundesland   text not null default 'NI';  -- German state code for public holidays
