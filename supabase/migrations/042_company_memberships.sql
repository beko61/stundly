-- ============================================================
-- 042_company_memberships.sql
-- Firmenzugehörigkeit mit Zeitraum: Mitarbeiter können die Firma verlassen
-- (selbst oder durch die Firma), die Firma sieht danach weiterhin die Daten
-- AUS DEM ZEITRAUM der Zugehörigkeit (GoBD/ArbZG) — und eine neue Firma sieht
-- keine Daten aus der Zeit vor dem Beitritt (DSGVO).
--
-- Sichtfenster je Mitgliedschaft: [visible_from, left_at]
--   visible_from null = ohne Untergrenze (neues Konto ohne eigene Daten beim Beitritt,
--                       damit der Foto-Import vergangener Wochen weiter funktioniert)
--   left_at      null = noch Mitglied
--
-- Mitgliedschaften entstehen/enden automatisch per Trigger, sobald sich
-- profiles.company_id ändert (Einladung, /join, Firma anlegen, Austritt).
-- Idempotent.
-- ============================================================

create table if not exists public.company_memberships (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  joined_at     date not null default current_date,
  visible_from  date,
  left_at       date,
  left_reason   text check (left_reason in ('left', 'removed')),
  left_by       uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- höchstens eine offene Mitgliedschaft pro Nutzer
create unique index if not exists company_memberships_open_uidx
  on public.company_memberships (user_id) where left_at is null;
create index if not exists company_memberships_company_idx
  on public.company_memberships (company_id, left_at);

alter table public.company_memberships enable row level security;

drop policy if exists "Own memberships readable" on public.company_memberships;
create policy "Own memberships readable"
  on public.company_memberships for select using (auth.uid() = user_id);

drop policy if exists "Company admin can view company memberships" on public.company_memberships;
create policy "Company admin can view company memberships"
  on public.company_memberships for select using (
    company_id = (select p.company_id from public.profiles p
                  where p.user_id = auth.uid() and p.role = 'company_admin')
  );
-- Schreiben nur per Trigger / service_role.

-- Bestand: alle aktuellen Firmenmitglieder ohne Untergrenze (bisheriges Verhalten)
insert into public.company_memberships (company_id, user_id, joined_at, visible_from)
select p.company_id, p.user_id, coalesce(p.created_at::date, current_date), null
from public.profiles p
where p.company_id is not null
  and not exists (select 1 from public.company_memberships m
                  where m.user_id = p.user_id and m.left_at is null);

-- ============================================================
-- Trigger: profiles.company_id → Mitgliedschaft öffnen/schließen
-- ============================================================
create or replace function public.sync_company_membership()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  old_company uuid := case when tg_op = 'UPDATE' then old.company_id else null end;
  has_data boolean;
begin
  if new.company_id is not distinct from old_company then
    return new;
  end if;

  -- alte Mitgliedschaft schließen
  if old_company is not null then
    update public.company_memberships
       set left_at = current_date
     where user_id = new.user_id and company_id = old_company and left_at is null;
  end if;

  -- neue Mitgliedschaft öffnen
  if new.company_id is not null then
    select exists (select 1 from public.time_entries t where t.user_id = new.user_id)
        or exists (select 1 from public.notdienst_entries n where n.user_id = new.user_id)
      into has_data;
    insert into public.company_memberships (company_id, user_id, joined_at, visible_from)
    values (new.company_id, new.user_id, current_date,
            case when has_data then current_date else null end);
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_sync_company_membership on public.profiles;
create trigger profiles_sync_company_membership
  after insert or update of company_id on public.profiles
  for each row execute function public.sync_company_membership();

-- ============================================================
-- Sichtbarkeit für Firmen-Admins: Datensatz-Datum im Fenster einer Mitgliedschaft
-- d null = irgendeine (auch frühere) Mitgliedschaft genügt
-- ============================================================
create or replace function public.company_admin_sees(target_user uuid, d date)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.profiles p_admin
    join public.company_memberships m on m.company_id = p_admin.company_id
    where p_admin.user_id = auth.uid()
      and p_admin.role = 'company_admin'
      and p_admin.company_id is not null
      and m.user_id = target_user
      and (d is null or m.visible_from is null or d >= m.visible_from)
      and (d is null or m.left_at is null or d <= m.left_at)
  );
$$;
grant execute on function public.company_admin_sees(uuid, date) to authenticated;

drop policy if exists "Company admin can view team time entries" on public.time_entries;
create policy "Company admin can view team time entries"
  on public.time_entries for select using (public.company_admin_sees(user_id, date));

drop policy if exists "Company admin can view team vacation requests" on public.vacation_requests;
create policy "Company admin can view team vacation requests"
  on public.vacation_requests for select using (public.company_admin_sees(user_id, start_date));

drop policy if exists "Company admin can view team notdienst" on public.notdienst_entries;
create policy "Company admin can view team notdienst"
  on public.notdienst_entries for select using (public.company_admin_sees(user_id, date));

drop policy if exists "Company admin can view team salary records" on public.salary_records;
create policy "Company admin can view team salary records"
  on public.salary_records for select using (public.company_admin_sees(user_id, make_date(year, month, 1)));

drop policy if exists "Company admin can view team month closings" on public.month_closings;
create policy "Company admin can view team month closings"
  on public.month_closings for select using (public.company_admin_sees(user_id, make_date(year, month, 1)));

drop policy if exists "Company admin can view team corrections" on public.entry_corrections;
create policy "Company admin can view team corrections"
  on public.entry_corrections for select using (public.company_admin_sees(user_id, entry_date));

drop policy if exists "Company admin can view team notdienst attachments" on public.notdienst_anhaenge;
create policy "Company admin can view team notdienst attachments"
  on public.notdienst_anhaenge for select using (public.company_admin_sees(user_id, null));

select 'Migration 042 erfolgreich: company_memberships + Sichtfenster.' as result;
