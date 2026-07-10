-- ============================================================
-- 023_salary_burlg_fields.sql
-- L6/L7 §5+§7 BUrlG — Beschäftigungszeitraum + Urlaubs-Übertrag
--
-- Yeni alanlar:
--   • salary_settings.employment_start_date — Beschäftigungsbeginn (§5 Zwölftelung)
--   • salary_settings.employment_end_date   — Beschäftigungsende (letzter Tag)
--   • salary_settings.urlaub_carry_over     — Übertrag Vorjahr (Tage, §7 III)
--
-- Alle nullable / default 0. Bestehende Nutzer sehen keine Änderung.
-- Idempotent — defalarca çalıştırılabilir.
-- ============================================================

alter table public.salary_settings
  add column if not exists employment_start_date date,
  add column if not exists employment_end_date   date,
  add column if not exists urlaub_carry_over     numeric(5,2) default 0
    check (urlaub_carry_over >= 0 and urlaub_carry_over <= 60);

comment on column public.salary_settings.employment_start_date is
  'Beschäftigungsbeginn — §5 BUrlG Zwölftelung des Urlaubsanspruchs bei unterjähriger Beschäftigung.';
comment on column public.salary_settings.employment_end_date is
  'Beschäftigungsende (letzter Arbeitstag) — §5 BUrlG. NULL = weiterhin aktiv.';
comment on column public.salary_settings.urlaub_carry_over is
  'Übertrag Urlaubstage aus Vorjahr — §7 III BUrlG. Muss bis 31.03 des laufenden Jahres genommen werden, sonst Verfall.';

select 'Migration 023 başarıyla tamamlandı: BUrlG alanları eklendi.' as result;
