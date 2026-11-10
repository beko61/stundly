-- ============================================================
-- 043_aufraeumen.sql — Faz 5 Aufräumen (ohne Datenverlust)
--
-- 1. audit_logs (alt, nur DSGVO-Ereignisse) → audit_log (eine Tabelle für alles).
--    Alte Zeilen werden kopiert; die alte Tabelle wird NICHT gelöscht, nur in
--    audit_logs_alt umbenannt (später von Hand löschbar).
-- 2. Nie benutzte Tabellen daily_logs, activity_logs, plan_features:
--    leer → löschen; enthalten Daten → nur in *_alt umbenennen.
--    Dazu die nie aufgerufene Funktion check_employee_limit (las plan_features).
-- Idempotent.
-- ============================================================

-- 1. Audit zusammenführen ------------------------------------------------
do $$
begin
  if to_regclass('public.audit_logs') is not null then
    insert into public.audit_log (created_at, actor_user_id, company_id, action, resource_type, resource_id, payload)
    select l.created_at, l.user_id, l.company_id, l.action, l.resource, l.resource_id,
           coalesce(l.metadata, '{}'::jsonb)
             || jsonb_strip_nulls(jsonb_build_object('ip_address', l.ip_address::text, 'user_agent', l.user_agent, 'quelle', 'audit_logs'))
    from public.audit_logs l;
    alter table public.audit_logs rename to audit_logs_alt;
    raise notice 'audit_logs kopiert und in audit_logs_alt umbenannt';
  end if;
end $$;

-- 2. Unbenutzte Tabellen --------------------------------------------------
drop function if exists public.check_employee_limit(uuid);

do $$
declare
  t text;
  n bigint;
begin
  foreach t in array array['daily_logs', 'activity_logs', 'plan_features'] loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('select count(*) from public.%I', t) into n;
    if n = 0 then
      execute format('drop table public.%I cascade', t);
      raise notice '% (leer) gelöscht', t;
    else
      execute format('alter table public.%I rename to %I', t, t || '_alt');
      raise notice '% hat % Zeilen → in %_alt umbenannt', t, n, t;
    end if;
  end loop;
end $$;

select 'Migration 043 erfolgreich: Audit zusammengeführt, unbenutzte Tabellen aufgeräumt.' as result;
