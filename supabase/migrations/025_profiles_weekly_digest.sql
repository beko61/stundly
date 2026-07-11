-- ============================================================
-- 025_profiles_weekly_digest.sql
-- Weekly digest email opt-in (retention feature).
-- Default false — mevcut kullanıcılara sürpriz mail atılmasın.
-- Settings sayfasında toggle.
-- Idempotent — defalarca çalıştırılabilir.
-- ============================================================

alter table public.profiles
  add column if not exists weekly_digest_enabled boolean default false;

comment on column public.profiles.weekly_digest_enabled is
  'Weekly digest email opt-in — Pazartesi 06:00 UTC otomatik ozet mail. Default false.';

-- Cron endpoint hizli sorgu için index (partial: sadece opt-in olanlar)
create index if not exists idx_profiles_weekly_digest_enabled
  on public.profiles (weekly_digest_enabled)
  where weekly_digest_enabled = true;

select 'Migration 025 başarıyla tamamlandı: weekly_digest_enabled eklendi.' as result;
