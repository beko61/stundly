-- ============================================================
-- 021 — Privilege Escalation Hardening (Security S1+S2+S3)
-- ============================================================
-- Audit 2026-07-09 bulguları:
--
-- S1 (Critical): profiles UPDATE policy'sinde `WITH CHECK` yoktu,
--   herhangi kullanıcı browser console'dan
--   `supabase.from("profiles").update({role: "super_admin"})` atıp
--   sistem yöneticisi olabiliyordu.
--
-- S2 (Critical): handle_new_user trigger'ı signup'ta
--   raw_user_meta_data->>'role' okuyordu. raw_user_meta_data
--   tamamen client-kontrollüdür (supabase.auth.signUp options.data).
--   Attacker signup'ta {role: "super_admin"} gönderirse trigger'a
--   inanıp direkt super_admin kaydediyordu.
--
-- S3 (Critical): 011 migration'daki "Company admin can manage
--   invitations" policy'si, 009'daki role kontrolünü DÜŞÜRMÜŞTÜ.
--   Herhangi bir employee kendi email'iyle role='company_admin'
--   invitation INSERT edip, sonra /api/invitations/accept çağırıp
--   company_admin'e yükselebiliyordu.
--
-- Fix stratejisi:
--   1. profiles UPDATE'te trigger — role/company_id/plan/is_active/
--      deleted_at/deleted_by/must_change_password kolonları sadece
--      service_role tarafından değiştirilebilir. Kullanıcı kendi
--      full_name/email/bundesland/hourly_rate vs güncelleyebilir.
--   2. handle_new_user — role/company_id metadata'dan okumaz,
--      her yeni kullanıcı 'individual' + null company başlar.
--      Company invitation'ları /api/invitations/accept'te
--      (service_role ile) uygulanır.
--   3. invitations "manage" policy — role predicate geri konur
--      (sadece company_admin/super_admin invitation yaratabilir).
--
-- Rollback:
--   drop trigger profiles_enforce_privileges on public.profiles;
--   drop function public.enforce_profile_privileges();
--   -- handle_new_user'ı geri almak için 011:342-370 blogunu apply et
--   -- invitations policy'sini eski (unrestricted) haline geri almak
--   -- için 011:158-174 apply et — AMA S3 açığı yeniden açılır.
-- ============================================================

-- ============================================================
-- 1. profiles: privileged column lock down (S1)
-- ============================================================
create or replace function public.enforce_profile_privileges()
returns trigger language plpgsql security definer as $$
begin
  -- service_role tüm değişikliklere izinli
  if auth.role() = 'service_role' then
    return new;
  end if;

  -- Aşağıdaki kolonları sadece server route (service_role) değiştirebilir
  if new.role is distinct from old.role then
    raise exception 'permission denied: role can only be changed by service role';
  end if;

  if new.company_id is distinct from old.company_id then
    raise exception 'permission denied: company_id can only be changed by service role';
  end if;

  if new.plan is distinct from old.plan then
    raise exception 'permission denied: plan can only be changed by service role';
  end if;

  if new.is_active is distinct from old.is_active then
    raise exception 'permission denied: is_active can only be changed by service role';
  end if;

  if new.deleted_at is distinct from old.deleted_at then
    raise exception 'permission denied: deleted_at can only be changed by service role';
  end if;

  if new.deleted_by is distinct from old.deleted_by then
    raise exception 'permission denied: deleted_by can only be changed by service role';
  end if;

  if new.must_change_password is distinct from old.must_change_password then
    raise exception 'permission denied: must_change_password can only be changed by service role';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_enforce_privileges on public.profiles;
create trigger profiles_enforce_privileges
  before update on public.profiles
  for each row execute function public.enforce_profile_privileges();

-- ============================================================
-- 2. handle_new_user — metadata'ya güvenme (S2)
-- ============================================================
-- KRİTİK KURAL: raw_user_meta_data client tarafından set edilir
-- (options.data via supabase.auth.signUp). ASLA güvenilmez.
-- Yeni user her zaman 'individual' + null company_id başlar.
-- Invitation-based yükseltmeler /api/invitations/accept'te
-- (server-side, service_role) yapılır.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, email, role, plan)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    'individual',
    'trial'
  )
  on conflict (user_id) do update set
    full_name = excluded.full_name,
    email     = excluded.email;
    -- NOT: role/plan/company_id burada güncellenmez.
    -- Var olan bir profil varsa (edge case: re-signup) ayrıcalıklarını
    -- korur. Yeni kullanıcı ise INSERT path ile 'individual' başlar.
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 3. invitations "manage" policy — role predicate geri (S3)
-- ============================================================
drop policy if exists "Company admin can manage invitations" on public.invitations;

create policy "Company admin can manage invitations"
  on public.invitations for all
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.company_id = invitations.company_id
        and p.role in ('company_admin', 'super_admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.company_id = invitations.company_id
        and p.role in ('company_admin', 'super_admin')
    )
  );

-- ============================================================
-- 4. Backfill audit — sistemde beklenmeyen super_admin var mı?
-- ============================================================
-- Bilgi amaçlı log — application-level'da manual kontrol edilir.
-- Migration'ı bloklamaz.
do $$
declare
  suspicious_count int;
begin
  select count(*) into suspicious_count
  from public.profiles
  where role = 'super_admin';

  if suspicious_count > 1 then
    raise notice 'AUDIT: % super_admin kullanıcı var. Manual verify et.', suspicious_count;
  end if;
end $$;
