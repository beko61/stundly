-- ============================================================
-- 012_salary_tax_settings.sql
-- salary_settings tablosuna Almanya vergi hesaplama alanları
-- (Steuerklasse, Kirchensteuer, Kind, Manuel mod)
-- Idempotent — defalarca çalıştırılabilir
-- ============================================================

alter table public.salary_settings
  add column if not exists steuerklasse    text default 'I'
    check (steuerklasse in ('I', 'II', 'III', 'IV', 'V', 'VI')),
  add column if not exists kirchensteuer   numeric(4,3) default 0
    check (kirchensteuer in (0, 0.08, 0.09)),
  add column if not exists hat_kinder      boolean default false,
  add column if not exists tax_mode        text default 'auto'
    check (tax_mode in ('auto', 'manual')),
  add column if not exists manuell_abzug   numeric(5,2) default 0
    check (manuell_abzug >= 0 and manuell_abzug <= 100);

comment on column public.salary_settings.steuerklasse  is 'Lohnsteuerklasse I-VI (default I)';
comment on column public.salary_settings.kirchensteuer is '0=keine, 0.08=BW/BY, 0.09=übrige Bundesländer';
comment on column public.salary_settings.hat_kinder    is 'Kind im Haushalt (Pflegeversicherung 1.7% vs 2.35%)';
comment on column public.salary_settings.tax_mode      is 'auto=echte Berechnung, manual=fixer % Abzug';
comment on column public.salary_settings.manuell_abzug is 'Prozent Abzug bei tax_mode=manual (0-100)';

select 'Migration 012 başarıyla tamamlandı: vergi alanları eklendi.' as result;
