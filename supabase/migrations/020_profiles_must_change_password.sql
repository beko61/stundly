-- ============================================================
-- 020_profiles_must_change_password.sql
-- Direkt Mitarbeiter erstellen akışı için must_change_password flag.
--
-- Mantık:
--   - Admin mitarbeiter'i direkt oluştururken geçici şifre belirler.
--   - profiles.must_change_password = true set edilir.
--   - Mitarbeiter ilk login'de /password-change sayfasına zorla yönlendirilir.
--   - Şifre değişince must_change_password = false yapılır.
--
-- Idempotent.
-- ============================================================

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

comment on column public.profiles.must_change_password is
  'true ise: ilk login sonrası /password-change sayfasına zorla yönlendirilir. Şifre değişince false olur.';

select 'Migration 020 basarili: must_change_password eklendi.' as result;
