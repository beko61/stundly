-- ============================================================
-- 024_rate_limit_events.sql
-- Persistent rate limiting store — replaces in-memory Map
-- (Audit R4+R5: In-memory Vercel serverless instance başına, çakışma var)
--
-- Kullanım: check.ts helper bir bucket için (örn. "scan:userId")
-- son N saniyedeki event sayısını sayar. Limit aşılırsa 429.
--
-- Cleanup: /api/cron/rate-limit-cleanup günlük eski rows'u siler.
-- Idempotent — defalarca çalıştırılabilir.
-- ============================================================

create table if not exists public.rate_limit_events (
  id         bigserial   primary key,
  bucket     text        not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rlm_bucket_created
  on public.rate_limit_events (bucket, created_at desc);

-- Alt-index cleanup için (created_at eski ise sil)
create index if not exists idx_rlm_created
  on public.rate_limit_events (created_at);

alter table public.rate_limit_events enable row level security;
-- Sadece service_role okur/yazar. Public policy yok — RLS default deny.

comment on table public.rate_limit_events is
  'Sliding-window rate limiter — service_role tarafından yazılır, cron ile temizlenir.';
comment on column public.rate_limit_events.bucket is
  'Rate limit key: örn. "scan:<user_id>" veya "contact:<ip>".';

select 'Migration 024 başarıyla tamamlandı: rate_limit_events tablosu oluşturuldu.' as result;
