-- ============================================================
-- 019_profiles_soft_delete.sql
-- Soft-delete altyapısı: profiles tablosuna deleted_at ekler.
--
-- Neden hard-delete yerine soft-delete:
--   - GoBD: time_entries 10 yıl saklanmalı (Mitarbeiter silinse bile)
--   - DSGVO: kullanıcı silme isteği farklı endpoint'le karşılanır
--             (/api/dsgvo/delete — gerçek silme + anonymize)
--   - Audit: kim ne zaman sildi izlenebilsin
--   - Restore: kazara silmede geri al
--
-- Soft-delete davranışı:
--   - profile.deleted_at = now() set edilir
--   - profile.is_active = false set edilir (login engellenir)
--   - time_entries, vacation_requests, notdienst_entries DOKUNULMAZ
--   - Tüm sorgu filtreleri "where deleted_at is null" eklemeli
--
-- Idempotent.
-- ============================================================

alter table public.profiles
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

-- Aktif mitarbeiter filter index'i (deleted_at is null daha verimli)
create index if not exists profiles_active_idx
  on public.profiles (company_id)
  where deleted_at is null;

comment on column public.profiles.deleted_at is
  'Soft-delete tarihi. null = aktif. Set ise mitarbeiter tüm UI listelerinden filtrelenir.';
comment on column public.profiles.deleted_by is
  'Soft-delete'i yapan company_admin (auth.users.id).';

select 'Migration 019 basarili: deleted_at + deleted_by + active index.' as result;
