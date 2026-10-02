-- 036_firma_briefkopf.sql
-- Briefkopf (Logo, Adresse, Telefon) pflegt der Chef im Firmen-Panel.
-- Mitarbeiter sehen ihn in ihren PDFs, koennen ihn aber nicht aendern.
-- Idempotent. Geschrieben nur ueber Server-Routen (service_role).

alter table public.companies
  add column if not exists phone     text check (phone is null or char_length(phone) <= 40),
  add column if not exists logo_data text check (logo_data is null or char_length(logo_data) <= 600000);

comment on column public.companies.phone     is 'Telefon im Briefkopf der PDFs.';
comment on column public.companies.logo_data is 'Firmenlogo als data:-URL (verkleinert), Briefkopf der PDFs.';

-- Nur die Briefkopf-Felder der eigenen Firma (nicht Steuerberater usw.)
create or replace function public.my_company_briefkopf()
returns table (name text, address_line1 text, postal_code text, city text, phone text, logo_data text)
language sql
stable
security definer
set search_path = public
as $$
  select c.name, c.address_line1, c.postal_code, c.city, c.phone, c.logo_data
  from public.companies c
  join public.profiles p on p.company_id = c.id
  where p.user_id = auth.uid()
    and p.deleted_at is null
  limit 1
$$;

revoke all on function public.my_company_briefkopf() from public;
grant execute on function public.my_company_briefkopf() to authenticated;

select 'Migration 036 erfolgreich: Firmen-Briefkopf' as result;
