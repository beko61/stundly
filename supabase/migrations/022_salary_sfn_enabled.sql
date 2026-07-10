-- ============================================================
-- 022_salary_sfn_enabled.sql
-- salary_settings.sfn_enabled — §3b EStG SFN-Zuschläge toggle
-- Default false: bestehende Nutzer sehen keine Änderung.
-- Idempotent — defalarca çalıştırılabilir
-- ============================================================

alter table public.salary_settings
  add column if not exists sfn_enabled boolean default false;

comment on column public.salary_settings.sfn_enabled is
  'Wenn true: §3b EStG SFN-Zuschläge (Sonntag/Feiertag/Nacht) automatisch aus Zeitstempeln berechnet, Steuer- und SV-Basis entsprechend reduziert.';

select 'Migration 022 başarıyla tamamlandı: sfn_enabled eklendi.' as result;
