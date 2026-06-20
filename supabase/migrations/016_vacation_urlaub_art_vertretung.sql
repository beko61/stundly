-- ============================================================
-- 016_vacation_urlaub_art_vertretung.sql
-- vacation_requests tablosuna iki alan ekler:
--   urlaub_art  Erholungsurlaub / Sonderurlaub / Bildungsurlaub /
--               Unbezahlter Urlaub / Elternzeit / Überstundenabbau
--   vertretung  Yerini alacak kişi (Vertretung) — Handwerk standardı
-- Idempotent — defalarca çalıştırılabilir.
-- ============================================================

alter table public.vacation_requests
  add column if not exists urlaub_art text default 'Erholungsurlaub',
  add column if not exists vertretung text;

comment on column public.vacation_requests.urlaub_art is
  'Urlaubstyp: Erholungsurlaub / Sonderurlaub / Bildungsurlaub / Unbezahlter Urlaub / Elternzeit / Überstundenabbau.';
comment on column public.vacation_requests.vertretung is
  'Vertretung waehrend Abwesenheit (optional, freitext).';

select 'Migration 016 basarili: urlaub_art + vertretung eklendi.' as result;
