-- ============================================================
-- 040_standard_times.sql — Standardzeiten im Profil (geräteübergreifend)
--
-- Bisher nur im Browser (localStorage "workly_standard_times_v1") → auf dem Handy
-- eingestellte Zeiten fehlten am PC. Jetzt profiles.standard_times; der Browser behält
-- eine Kopie (Offline, schnelle Vorbelegung) und gleicht beim Start ab.
--
-- Format: {"monThuStart":"07:45","monThuEnd":"17:00","monThuPause":60,
--          "friStart":"07:45","friEnd":"14:30","friPause":30}
-- null = noch nie gespeichert (App nimmt Standardwerte).
-- Bestehende Policy "eigenes Profil ändern" deckt die Spalte ab; kein Trigger nötig.
--
-- Idempotent — kann mehrfach ausgeführt werden.
-- Rückgängig: alter table public.profiles drop column if exists standard_times;
-- ============================================================

alter table public.profiles
  add column if not exists standard_times jsonb;

comment on column public.profiles.standard_times is
  'Standardzeiten Mo-Do/Fr (Beginn, Ende, Pause in Min.) fuer neue Eintraege und Jahres-Befuellung. null = Standardwerte.';

select 'Migration 040 erfolgreich: profiles.standard_times.' as result;
