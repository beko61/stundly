-- 044_ueberstunden_uebertrag.sql — Überstunden-Übertrag ins neue Jahr (19.11.2026)
--
-- Lohn-Einstellungen gelten je Jahr (v0.101.0, salary_settings.valid_from). Neu: Übertrag der
-- Überstunden aus dem Vorjahr in Stunden. NULL = automatisch (Vorjahres-Saldo wird vorgeschlagen),
-- Zahl = vom Nutzer gesetzt (z. B. wenn die Firma einen Teil ausgezahlt hat). Negativ = Minusstunden.
--
-- Rückgängig: alter table public.salary_settings drop column if exists ueberstunden_uebertrag;

alter table public.salary_settings
  add column if not exists ueberstunden_uebertrag numeric(7,2);

comment on column public.salary_settings.ueberstunden_uebertrag is
  'Überstunden-Übertrag aus dem Vorjahr (Stunden). NULL = automatisch aus dem Vorjahres-Saldo.';
