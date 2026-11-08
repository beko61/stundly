-- ============================================================
-- 038_sicherheit.sql — Faz 2 Sicherheit (vor Stripe)
--
--   2.1 vacation_requests: Status/Entscheidung nur serverseitig (service_role)
--       → Mitarbeiter kann den eigenen Antrag nicht per Browser-Konsole genehmigen.
--   2.2 invitations: offene Policy "Anyone can view pending invitation by token" entfernt
--       (jeder, auch ohne Login, konnte ALLE offenen Einladungen mit E-Mail + Firma lesen).
--       Ersatz: RPC invitation_preview(token) — liefert nur die eine Einladung zum Token.
--   2.4 companies: max_employees / owner_id nur serverseitig;
--       RPC my_subscription_status() — Firma-Tarif nur mit laufendem Firmen-Abo.
--   2.7 search_path = public für alle Funktionen in public, denen er fehlt.
--
-- Idempotent — kann mehrfach ausgeführt werden.
-- Rückgängig (Notfall):
--   drop trigger vacation_requests_lock_decision on public.vacation_requests;
--   drop trigger companies_lock_billing_fields on public.companies;
--   create policy "Anyone can view pending invitation by token" on public.invitations
--     for select using (status = 'pending' and expires_at > now());
-- ============================================================

-- ── 2.1 Urlaubsentscheidung nur über den Server ──────────────
create or replace function public.vacation_requests_lock_decision()
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

  if tg_op = 'INSERT' then
    new.status           := 'pending';
    new.approved_at      := null;
    new.approved_by      := null;
    new.rejected_at      := null;
    new.rejection_reason := null;
    return new;
  end if;

  if new.status           is distinct from old.status
  or new.approved_at      is distinct from old.approved_at
  or new.approved_by      is distinct from old.approved_by
  or new.rejected_at      is distinct from old.rejected_at
  or new.rejection_reason is distinct from old.rejection_reason then
    raise exception 'permission denied: vacation decision can only be set by the server';
  end if;

  -- Zeitraum eines entschiedenen Antrags geaendert → wieder offen
  if old.status <> 'pending' and (
       new.start_date is distinct from old.start_date
    or new.end_date   is distinct from old.end_date
    or new.days_count is distinct from old.days_count
    or new.urlaub_art is distinct from old.urlaub_art) then
    new.status           := 'pending';
    new.approved_at      := null;
    new.approved_by      := null;
    new.rejected_at      := null;
    new.rejection_reason := null;
  end if;
  return new;
end;
$$;

drop trigger if exists vacation_requests_lock_decision on public.vacation_requests;
create trigger vacation_requests_lock_decision
  before insert or update on public.vacation_requests
  for each row execute function public.vacation_requests_lock_decision();

-- ── 2.2 Einladungen nicht mehr offen lesbar ──────────────────
drop policy if exists "Anyone can view pending invitation by token" on public.invitations;

create or replace function public.invitation_preview(p_token text)
returns table (email text, company_name text)
language sql
stable
security definer
set search_path = public
as $$
  select i.email, c.name
  from public.invitations i
  left join public.companies c on c.id = i.company_id
  where i.token = p_token
    and i.status = 'pending'
    and i.expires_at > now()
  limit 1;
$$;

revoke all on function public.invitation_preview(text) from public;
grant execute on function public.invitation_preview(text) to anon, authenticated;

-- ── 2.4 Firmen-Limits nur serverseitig ───────────────────────
create or replace function public.companies_lock_billing_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.max_employees := 10;
  else
    new.max_employees := old.max_employees;
    new.owner_id      := old.owner_id;
  end if;
  return new;
end;
$$;

drop trigger if exists companies_lock_billing_fields on public.companies;
create trigger companies_lock_billing_fields
  before insert or update on public.companies
  for each row execute function public.companies_lock_billing_fields();

-- ── 2.4 Laufendes Abo? (Mitarbeiter sehen das Firmen-Abo sonst nicht) ──
create or replace function public.my_subscription_status()
returns table (company_active boolean, personal_active boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.subscriptions s
      join public.profiles p on p.company_id = s.company_id
      where p.user_id = auth.uid()
        and (s.status = 'active' or (s.status = 'trialing' and s.trial_end > now()))
    ),
    exists (
      select 1
      from public.subscriptions s
      where s.user_id = auth.uid()
        and (s.status = 'active' or (s.status = 'trialing' and s.trial_end > now()))
    );
$$;

revoke all on function public.my_subscription_status() from public;
grant execute on function public.my_subscription_status() to authenticated;

-- ── 2.7 search_path für alle Funktionen in public, denen er fehlt ──
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c where c like 'search_path=%'
      )
  loop
    execute format('alter function %s set search_path = public', r.sig);
    raise notice 'search_path gesetzt: %', r.sig;
  end loop;
end;
$$;

select 'Migration 038 erfolgreich: Urlaub-Entscheidung, Einladungen, Firmen-Limits, Abo-Status, search_path.' as result;
