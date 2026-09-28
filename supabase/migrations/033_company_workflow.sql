-- 033_company_workflow.sql
-- Firmen-Workflow: Vertragsdaten, Monatsabschluss, Korrekturen mit Begründung, Schutzregeln.
--
-- Prinzip: Mitarbeiter erfassen selbst, die Firma sieht alles, bestätigt Monate und darf
-- korrigieren — aber nie heimlich (jede Korrektur mit Begründung, für den Mitarbeiter sichtbar).
-- Alle schreibenden Firmen-Aktionen laufen über Server-Routen (service_role).

-- ============================================================
-- 1. Vertragsdaten — vom Arbeitgeber gepflegt (profiles)
-- ============================================================
alter table public.profiles
  add column if not exists contract_weekly_hours  numeric(5,2),
  add column if not exists contract_vacation_days numeric(4,1),
  add column if not exists contract_start         date;

comment on column public.profiles.contract_weekly_hours  is 'Vertragliche Wochenstunden (von der Firma gesetzt; null = Mitarbeiter pflegt selbst)';
comment on column public.profiles.contract_vacation_days is 'Jährlicher Urlaubsanspruch laut Vertrag (von der Firma gesetzt)';
comment on column public.profiles.contract_start         is 'Beschäftigungsbeginn (von der Firma gesetzt)';

-- Nur service_role darf Vertragsdaten ändern (Erweiterung von 021 enforce_profile_privileges)
create or replace function public.enforce_profile_contract()
returns trigger language plpgsql security definer as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if new.contract_weekly_hours  is distinct from old.contract_weekly_hours
  or new.contract_vacation_days is distinct from old.contract_vacation_days
  or new.contract_start         is distinct from old.contract_start then
    raise exception 'permission denied: Vertragsdaten legt die Firma fest';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_enforce_contract on public.profiles;
create trigger profiles_enforce_contract
  before update on public.profiles
  for each row execute function public.enforce_profile_contract();

-- salary_settings: Soll-Stunden + Urlaubsanspruch folgen dem Vertrag, wenn die Firma ihn gesetzt hat
create or replace function public.salary_settings_follow_contract()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  wk numeric; vac numeric;
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  select contract_weekly_hours, contract_vacation_days into wk, vac
    from public.profiles where user_id = new.user_id;
  if wk is not null then
    new.monthly_target_hours := round(wk * 52 / 12, 2);
  end if;
  if vac is not null then
    new.urlaub_anspruch := vac;
  end if;
  return new;
end;
$$;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'salary_settings' and column_name = 'urlaub_anspruch') then
    execute 'drop trigger if exists salary_settings_follow_contract on public.salary_settings';
    execute 'create trigger salary_settings_follow_contract before insert or update on public.salary_settings
             for each row execute function public.salary_settings_follow_contract()';
  end if;
end $$;

-- ============================================================
-- 2. Monatsabschluss
-- ============================================================
create table if not exists public.month_closings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  company_id    uuid references public.companies(id) on delete cascade,
  year          int  not null,
  month         int  not null check (month between 1 and 12),
  status        text not null check (status in ('submitted', 'approved')),
  submitted_at  timestamptz,
  approved_at   timestamptz,
  approved_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (user_id, year, month)
);

create index if not exists month_closings_company_idx on public.month_closings (company_id, year, month);

alter table public.month_closings enable row level security;

drop policy if exists "Own month closings readable" on public.month_closings;
create policy "Own month closings readable"
  on public.month_closings for select using (auth.uid() = user_id);

drop policy if exists "Company admin can view team month closings" on public.month_closings;
create policy "Company admin can view team month closings"
  on public.month_closings for select using (public.is_company_member_of_admin(user_id));
-- Schreiben nur über Server-Routen (service_role) — keine insert/update-Policies.

-- ============================================================
-- 3. Korrekturen durch die Firma
-- ============================================================
create table if not exists public.entry_corrections (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  company_id    uuid references public.companies(id) on delete cascade,
  entity        text not null check (entity in ('time_entry', 'notdienst')),
  entry_date    date not null,
  before        jsonb,
  after         jsonb,
  reason        text not null check (length(trim(reason)) >= 3),
  corrected_by  uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  seen_at       timestamptz
);

create index if not exists entry_corrections_user_idx on public.entry_corrections (user_id, created_at desc);

alter table public.entry_corrections enable row level security;

drop policy if exists "Own corrections readable" on public.entry_corrections;
create policy "Own corrections readable"
  on public.entry_corrections for select using (auth.uid() = user_id);

drop policy if exists "Company admin can view team corrections" on public.entry_corrections;
create policy "Company admin can view team corrections"
  on public.entry_corrections for select using (public.is_company_member_of_admin(user_id));

-- ============================================================
-- 4. Schutz: bestätigte Monate sind gesperrt
-- ============================================================
-- Notdienst zählt zum Monat des Wochen-Sonntags (wie lib/utils/weekMonth.notdienstMonthOf)
create or replace function public.notdienst_month_date(d date)
returns date language sql immutable as $$
  select d + ((7 - extract(isodow from d)::int) % 7);
$$;

create or replace function public.month_is_approved(uid uuid, d date)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.month_closings mc
    where mc.user_id = uid and mc.status = 'approved'
      and mc.year = extract(year from d)::int and mc.month = extract(month from d)::int
  );
$$;

create or replace function public.guard_locked_month()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_nd boolean := tg_table_name = 'notdienst_entries';
  d_old date; d_new date;
begin
  if auth.role() = 'service_role' then
    return coalesce(new, old);
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    d_old := case when is_nd then public.notdienst_month_date(old.date) else old.date end;
    if public.month_is_approved(old.user_id, d_old) then
      raise exception 'Monat ist abgeschlossen — Änderungen nur durch die Firma';
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    d_new := case when is_nd then public.notdienst_month_date(new.date) else new.date end;
    if public.month_is_approved(new.user_id, d_new) then
      raise exception 'Monat ist abgeschlossen — Änderungen nur durch die Firma';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists time_entries_guard_locked_month on public.time_entries;
create trigger time_entries_guard_locked_month
  before insert or update or delete on public.time_entries
  for each row execute function public.guard_locked_month();

drop trigger if exists notdienst_guard_locked_month on public.notdienst_entries;
create trigger notdienst_guard_locked_month
  before insert or update or delete on public.notdienst_entries
  for each row execute function public.guard_locked_month();

-- ============================================================
-- 5. Schutz: Notdienst "bezahlt" setzt bei Firmen-Mitarbeitern die Firma
-- ============================================================
create or replace function public.guard_notdienst_paid()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if new.erledigt is distinct from old.erledigt and exists (
    select 1 from public.profiles p
    where p.user_id = new.user_id and p.company_id is not null and p.role = 'employee'
  ) then
    raise exception 'Den Bezahlt-Status setzt deine Firma';
  end if;
  return new;
end;
$$;

drop trigger if exists notdienst_guard_paid on public.notdienst_entries;
create trigger notdienst_guard_paid
  before update on public.notdienst_entries
  for each row execute function public.guard_notdienst_paid();

select 'Migration 033 erfolgreich: Vertragsdaten, month_closings, entry_corrections, Monatssperre, Bezahlt-Schutz' as result;
