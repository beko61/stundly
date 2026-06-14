-- ============================================================
-- 015_company_admin_read_access.sql
-- Company admin can SELECT team members' time/vacation/notdienst data
-- ------------------------------------------------------------
-- Why: Önceki RLS'ler (003, 004, 002) sadece "auth.uid() = user_id" izin verdi.
-- Şirket modunda admin, kendi şirketindeki tüm mitarbeiter'in time_entries,
-- vacation_requests, notdienst_entries kayıtlarını GÖRMELİ (read-only).
-- Yazma yetkisi (insert/update/delete) hâlâ sadece sahip user'da.
--
-- Bu migration idempotent: policy'ler "if not exists" benzeri "drop then create"
-- pattern ile yeniden uygulanabilir.
-- ============================================================

-- Helper: belirtilen user_id, çağıran admin'in şirketinde mi?
create or replace function public.is_company_member_of_admin(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p_admin
    join public.profiles p_target on p_target.company_id = p_admin.company_id
    where p_admin.user_id = auth.uid()
      and p_admin.role in ('company_admin', 'super_admin')
      and p_admin.company_id is not null
      and p_target.user_id = target_user
  );
$$;

grant execute on function public.is_company_member_of_admin(uuid) to authenticated;

-- ============================================================
-- time_entries — admin read access
-- ============================================================
drop policy if exists "Company admin can view team time entries" on public.time_entries;
create policy "Company admin can view team time entries"
  on public.time_entries
  for select
  using (public.is_company_member_of_admin(user_id));

-- ============================================================
-- vacation_requests — admin read access (approve/reject F4'te eklenecek)
-- ============================================================
drop policy if exists "Company admin can view team vacation requests" on public.vacation_requests;
create policy "Company admin can view team vacation requests"
  on public.vacation_requests
  for select
  using (public.is_company_member_of_admin(user_id));

-- ============================================================
-- notdienst_entries — admin read access
-- (varsa — yoksa hata vermesin: bu blok try/catch ile sarılır)
-- ============================================================
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'notdienst_entries') then
    execute 'drop policy if exists "Company admin can view team notdienst" on public.notdienst_entries';
    execute 'create policy "Company admin can view team notdienst" on public.notdienst_entries for select using (public.is_company_member_of_admin(user_id))';
  end if;
end $$;

-- ============================================================
-- daily_logs — admin read access
-- ============================================================
drop policy if exists "Company admin can view team daily logs" on public.daily_logs;
create policy "Company admin can view team daily logs"
  on public.daily_logs
  for select
  using (public.is_company_member_of_admin(user_id));

-- ============================================================
-- salary_records — admin read access (varsa)
-- ============================================================
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'salary_records') then
    execute 'drop policy if exists "Company admin can view team salary records" on public.salary_records';
    execute 'create policy "Company admin can view team salary records" on public.salary_records for select using (public.is_company_member_of_admin(user_id))';
  end if;
end $$;
