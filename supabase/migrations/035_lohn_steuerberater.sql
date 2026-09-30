-- 035_lohn_steuerberater.sql
-- Firmen-Panel Phase D: Lohn-Vorbereitung an den Steuerberater + Montags-Ueberblick fuer den Chef.
-- Idempotent. Geschrieben nur ueber Server-Routen (service_role).

alter table public.companies
  add column if not exists steuerberater_email     text
    check (steuerberater_email is null or steuerberater_email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'),
  add column if not exists steuerberater_auto      boolean not null default false,
  add column if not exists steuerberater_last_sent text,
  add column if not exists team_digest_enabled     boolean not null default false;

comment on column public.companies.steuerberater_email     is 'E-Mail des Steuerberaters / Lohnbueros fuer die monatliche Lohn-Vorbereitung.';
comment on column public.companies.steuerberater_auto      is 'true = Lohn-Vorbereitung des Vormonats automatisch am 5. versenden.';
comment on column public.companies.steuerberater_last_sent is 'Zuletzt automatisch versendeter Monat (YYYY-MM) — verhindert Doppelversand.';
comment on column public.companies.team_digest_enabled     is 'true = Chef bekommt montags einen Team-Ueberblick per E-Mail.';

select 'Migration 035 erfolgreich: Steuerberater + Montags-Ueberblick' as result;
