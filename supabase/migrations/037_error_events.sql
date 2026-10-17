-- ============================================================
-- 037_error_events.sql
-- Eigene Fehlerüberwachung (ohne externen Dienst):
--   Browser-Fehler  → POST /api/errors        (source = 'client')
--   Server-Fehler   → instrumentation.ts       (source = 'server')
-- Süper admin görür: /superadmin/errors · günlük mail: /api/cron/error-digest
-- Kayıtlar 30 gün sonra cron tarafından silinir.
-- Idempotent — defalarca çalıştırılabilir.
-- ============================================================

create table if not exists public.error_events (
  id          bigserial   primary key,
  created_at  timestamptz not null default now(),
  source      text        not null check (source in ('client', 'server')),
  fingerprint text        not null,
  message     text        not null,
  stack       text,
  location    text,
  path        text,
  digest      text,
  user_id     uuid,
  user_agent  text,
  app_version text
);

create index if not exists idx_error_events_created
  on public.error_events (created_at desc);

create index if not exists idx_error_events_fp_created
  on public.error_events (fingerprint, created_at desc);

alter table public.error_events enable row level security;
-- Sadece service_role okur/yazar. Public policy yok — RLS default deny.

comment on table public.error_events is
  'Fehlerereignisse (Browser + Server) — service_role schreibt, Cron löscht nach 30 Tagen.';

select 'Migration 037 başarıyla tamamlandı: error_events tablosu oluşturuldu.' as result;
