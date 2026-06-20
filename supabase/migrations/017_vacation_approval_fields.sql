-- ============================================================
-- 017_vacation_approval_fields.sql
-- vacation_requests tablosuna karar (Entscheidung) alanları ekler:
--   approved_at        ne zaman onaylandı
--   approved_by        kim onayladı (uuid → auth.users)
--   rejected_at        ne zaman reddedildi
--   rejection_reason   ret gerekçesi (opsiyonel)
--
-- Ek RLS politikası: company_admin (veya super_admin) AYNI ŞİRKETTEKİ
-- çalışanların vacation_requests kayıtlarını UPDATE edebilir.
-- Bu sayede F4 admin approval UI çalışır.
--
-- Idempotent — defalarca çalıştırılabilir.
-- ============================================================

alter table public.vacation_requests
  add column if not exists approved_at      timestamptz,
  add column if not exists approved_by      uuid references auth.users(id) on delete set null,
  add column if not exists rejected_at      timestamptz,
  add column if not exists rejection_reason text;

comment on column public.vacation_requests.approved_at      is 'Genehmigung-Zeitstempel (UTC).';
comment on column public.vacation_requests.approved_by      is 'Welcher company_admin hat genehmigt (auth.users.id).';
comment on column public.vacation_requests.rejected_at      is 'Ablehnung-Zeitstempel (UTC).';
comment on column public.vacation_requests.rejection_reason is 'Begruendung der Ablehnung (optional).';

-- ── RLS: company_admin same-company UPDATE ──
-- Helper function is_company_member_of_admin() Migration 015'te eklendi.
-- Eski policy 'Users can CRUD own vacation requests' user_id eşitliği gerektiriyor.
-- Bu policy onu KAPSAMAZ; admin kendi user_id'siyle UPDATE etmez.
-- Yeni policy ek olarak admin'in aynı şirketteki çalışanın kaydını UPDATE etmesine izin verir.

drop policy if exists "Company admin can update team vacations" on public.vacation_requests;
create policy "Company admin can update team vacations"
  on public.vacation_requests for update
  using (
    public.is_company_member_of_admin(user_id)
  )
  with check (
    public.is_company_member_of_admin(user_id)
  );

select 'Migration 017 basarili: approval alanlari + admin UPDATE policy.' as result;
