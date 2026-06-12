-- ============================================================
-- 014_firma_adresse.sql
-- profiles tablosuna firma adres alanları ekler (PDF için).
-- Urlaubsantrag PDF'i ve aylık raporlar bu bilgileri kullanır.
-- Idempotent — defalarca çalıştırılabilir.
-- ============================================================

alter table public.profiles
  add column if not exists firma_strasse  text,
  add column if not exists firma_plz      text,
  add column if not exists firma_ort      text,
  add column if not exists firma_telefon  text;

comment on column public.profiles.firma_strasse is 'Firma Straße + Hausnummer (z.B. "Tiergarten 122")';
comment on column public.profiles.firma_plz     is 'Firma Postleitzahl (z.B. "30559")';
comment on column public.profiles.firma_ort     is 'Firma Stadt / Ort (z.B. "Hannover")';
comment on column public.profiles.firma_telefon is 'Firma Telefonnummer (optional, für PDF Briefkopf)';

select 'Migration 014 başarıyla tamamlandı: firma adres alanları eklendi.' as result;
