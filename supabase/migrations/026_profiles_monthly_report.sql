-- ============================================================
-- 026_profiles_monthly_report.sql
-- Monthly report email opt-in (retention feature #2).
-- Default false. Settings toggle.
-- Idempotent — defalarca çalıştırılabilir.
-- ============================================================

alter table public.profiles
  add column if not exists monthly_report_enabled boolean default false;

comment on column public.profiles.monthly_report_enabled is
  'Monthly report email opt-in — her ayın 1'inde önceki ayın özeti + /reports linki. Default false.';

create index if not exists idx_profiles_monthly_report_enabled
  on public.profiles (monthly_report_enabled)
  where monthly_report_enabled = true;

select 'Migration 026 başarıyla tamamlandı: monthly_report_enabled eklendi.' as result;
