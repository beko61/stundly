-- ============================================================
-- 018_audit_log.sql
-- DSGVO + GoBD denetlenebilirlik için audit_log tablosu.
--
-- Saklanan veri:
--   id              uuid pk
--   created_at      timestamptz default now()
--   actor_user_id   uuid — eylemi yapan kullanıcı (genelde company_admin)
--   company_id      uuid — eylemin ait olduğu şirket (RLS scope için)
--   action          text — kısa eylem kimliği (snake_case enum string)
--                          örn: vacation.approved / vacation.rejected /
--                               employee.activated / employee.deactivated
--   resource_type   text — örn: vacation_request / profile
--   resource_id     uuid — etkilenen kayıt id'si (opsiyonel)
--   payload         jsonb — eyleme özgü meta (örn rejection_reason)
--
-- RLS:
--   - super_admin tümünü görür
--   - company_admin sadece kendi şirketinin audit'ini görür
--   - normal user kendi etkilendiği audit'leri görmez (Verschleierungs-Risiko)
--
-- Idempotent — defalarca çalıştırılabilir.
-- ============================================================

create table if not exists public.audit_log (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz not null default now(),
  actor_user_id uuid references auth.users(id) on delete set null,
  company_id    uuid references public.companies(id) on delete cascade,
  action        text not null,
  resource_type text,
  resource_id   uuid,
  payload       jsonb default '{}'::jsonb
);

-- Hızlı sorgu indeksleri
create index if not exists audit_log_company_created_idx
  on public.audit_log (company_id, created_at desc);
create index if not exists audit_log_actor_idx
  on public.audit_log (actor_user_id, created_at desc);
create index if not exists audit_log_resource_idx
  on public.audit_log (resource_type, resource_id);

-- RLS
alter table public.audit_log enable row level security;

drop policy if exists "Company admin can read company audit log" on public.audit_log;
create policy "Company admin can read company audit log"
  on public.audit_log for select
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.company_id = public.audit_log.company_id
        and (p.role = 'company_admin' or p.role = 'super_admin')
    )
  );

-- INSERT/UPDATE/DELETE policy YOK — sadece service-role (server route) yazabilir.
-- Bu bilinçli güvenlik kararı: audit kayıtları yalnızca güvenilir server-tarafından
-- yazılır, kullanıcılar doğrudan ekleyemez/değiştiremez.

comment on table public.audit_log is
  'DSGVO + GoBD denetim kayıtları. Sadece service-role yazar, company_admin okur.';

select 'Migration 018 basarili: audit_log tablosu + RLS policy.' as result;
