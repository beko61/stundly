-- ============================================================
-- 030_notdienst_kunde_telefon.sql
-- Telefonnummer des Kunden am Notdienst-Einsatz (v0.63.0).
-- Idempotent — kann gefahrlos mehrfach ausgefuehrt werden.
-- RLS der Tabelle gilt unveraendert (eigene Zeilen / Firmen-Admin lesen).
-- ============================================================

alter table public.notdienst_entries
  add column if not exists kunde_telefon text;
