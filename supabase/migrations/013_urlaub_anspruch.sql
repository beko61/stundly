-- ============================================================
-- 013_urlaub_anspruch.sql
-- salary_settings tablosuna yıllık Urlaub hak günü alanı ekler.
-- Default 30 (Almanya tam yıllık sözleşmeli çalışan ortalaması).
-- Idempotent — defalarca çalıştırılabilir.
-- ============================================================

alter table public.salary_settings
  add column if not exists urlaub_anspruch int default 30
    check (urlaub_anspruch >= 0 and urlaub_anspruch <= 60);

comment on column public.salary_settings.urlaub_anspruch is
  'Jährlicher Urlaubsanspruch in Tagen (Default 30, Bandbreite 0-60).';

select 'Migration 013 başarıyla tamamlandı: urlaub_anspruch eklendi.' as result;
