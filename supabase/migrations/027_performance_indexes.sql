-- ============================================================
-- 027_performance_indexes.sql
-- Query pattern'ına göre 4 hedefe yönelik index.
--
-- Not: audit "0 CREATE INDEX" iddia etmişti ama 26 migration'da 13
-- index zaten var. Bu migration gerçek gap'ları kapatır.
--
-- Idempotent (CREATE INDEX IF NOT EXISTS). Concurrently değil — küçük
-- ölçekli beta DB, kısa lock kabul edilebilir. Prod'da CONCURRENTLY
-- gerekirse ayrı bir migration.
-- ============================================================

-- 1. time_entries.tags GIN — sample data DELETE için KRİTİK
--    (contains("tags", ["sample"]) sorgusu full-table scan yapıyordu)
create index if not exists idx_time_entries_tags_gin
  on public.time_entries using gin (tags);

-- 2. vacation_requests (user_id, status) — pending Urlaub filter
--    (company dashboard + vacation page + weekly digest)
create index if not exists idx_vacation_requests_user_status
  on public.vacation_requests (user_id, status);

-- 3. salary_settings (user_id, created_at DESC) — "en son settings"
--    (dashboard, salary, reports/data endpoint — hepsi bu pattern'ı kullanıyor)
create index if not exists idx_salary_settings_user_created
  on public.salary_settings (user_id, created_at desc);

-- 4. time_entries (user_id, day_type, date) — day_type filter
--    (Urlaub/Krank/Arbeiten sayacı — MonthlySummary, dashboard, reports)
--    Mevcut (user_id, date) tek başına yeterli değil çünkü day_type
--    ayrı kolon üzerinde filter var, index-only scan mümkün olmuyor
create index if not exists idx_time_entries_user_daytype_date
  on public.time_entries (user_id, day_type, date);

comment on index public.idx_time_entries_tags_gin is
  'GIN index for tags array — sample data cleanup + tag search.';
comment on index public.idx_vacation_requests_user_status is
  'Pending Urlaub filter (company dashboard, vacation, weekly digest).';
comment on index public.idx_salary_settings_user_created is
  'Latest salary_settings per user (dashboard/salary/reports).';
comment on index public.idx_time_entries_user_daytype_date is
  'day_type filter (Urlaub/Krank/Arbeiten sayacı — all pages).';

select 'Migration 027 başarıyla tamamlandı: 4 performance index eklendi.' as result;
