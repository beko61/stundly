-- ============================================================
-- 039_super_admin_flag.sql — Super-Admin als eigenes Merkmal (profiles.is_super_admin)
--
-- Problem: profiles.role hielt Plattform-Rolle (super_admin) UND Firmen-Rolle
-- (employee / company_admin / individual). Trat der Super-Admin einer Firma als
-- Mitarbeiter bei (Einladung schreibt role = employee), war die Super-Admin-
-- Berechtigung weg.
--
-- Lösung:
--   - profiles.is_super_admin (boolean) = Plattform-Berechtigung
--   - profiles.role = nur noch Rolle in der Firma
--   - Bestehende super_admin: is_super_admin = true; role -> company_admin, wenn an
--     eine Firma gebunden (bisherige Firmenrechte bleiben), sonst individual.
--   - is_super_admin darf nur service_role / SQL-Editor ändern.
--
-- Alte Policies/Funktionen mit role = 'super_admin' bleiben unverändert: niemand hat
-- diese Rolle mehr, sie greifen also nicht. Das Super-Admin-Panel liest per
-- service_role (nicht über RLS).
--
-- Idempotent — kann mehrfach ausgeführt werden.
-- Rückgängig (Notfall):
--   alter table public.profiles disable trigger profiles_enforce_privileges;
--   update public.profiles set role = 'super_admin' where is_super_admin;
--   alter table public.profiles enable trigger profiles_enforce_privileges;
--   drop trigger if exists profiles_enforce_super_admin on public.profiles;
--   drop trigger if exists profiles_enforce_super_admin_insert on public.profiles;
-- ============================================================

alter table public.profiles
  add column if not exists is_super_admin boolean not null default false;

comment on column public.profiles.is_super_admin is
  'Plattform-Admin (Stundly-Betreiber). Unabhaengig von role (= Rolle in der Firma). Nur service_role.';

-- ── Bestehende Super-Admins umziehen ─────────────────────────
-- role darf sonst nur service_role ändern (021) -> Trigger kurz aus.
alter table public.profiles disable trigger profiles_enforce_privileges;

update public.profiles set is_super_admin = true where role = 'super_admin';

update public.profiles
   set role = case when company_id is not null then 'company_admin'::user_role
                   else 'individual'::user_role end
 where role = 'super_admin';

alter table public.profiles enable trigger profiles_enforce_privileges;

-- ── is_super_admin nur serverseitig ──────────────────────────
create or replace function public.enforce_profile_super_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Server (service_role) und SQL-Editor dürfen alles
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.is_super_admin is distinct from old.is_super_admin then
    raise exception 'permission denied: is_super_admin can only be changed by service role';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_enforce_super_admin on public.profiles;
create trigger profiles_enforce_super_admin
  before update on public.profiles
  for each row execute function public.enforce_profile_super_admin();

-- Neue Konten: is_super_admin kommt nie aus dem Browser
create or replace function public.enforce_profile_super_admin_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    new.is_super_admin := false;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_enforce_super_admin_insert on public.profiles;
create trigger profiles_enforce_super_admin_insert
  before insert on public.profiles
  for each row execute function public.enforce_profile_super_admin_insert();

select 'Migration 039 basarili: ' || count(*) || ' Super-Admin (is_super_admin).' as result
  from public.profiles where is_super_admin;
