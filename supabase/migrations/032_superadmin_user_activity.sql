-- 032_superadmin_user_activity.sql
-- Super-Admin "Beta-Cockpit": Aktivität pro Nutzer in EINER Abfrage (statt tausender Zeilen,
-- PostgREST liefert max. 1000 pro Request). Beispieldaten zählen nicht.
-- Nur für service_role ausführbar (Super-Admin-Seiten laufen serverseitig mit Service-Key).

create or replace function public.superadmin_user_activity()
returns table (
  user_id       uuid,
  entry_days    bigint,
  last_entry_at timestamptz,
  nd_count      bigint,
  last_nd_at    timestamptz
)
language sql
security definer
set search_path = public
as $$
  with te as (
    select t.user_id, count(*) as entry_days, max(greatest(t.created_at, t.updated_at)) as last_entry_at
    from public.time_entries t
    where not ('sample' = any(coalesce(t.tags, '{}')))
    group by t.user_id
  ),
  nd as (
    select n.user_id, count(*) as nd_count, max(n.created_at) as last_nd_at
    from public.notdienst_entries n
    where coalesce(n.note, '') not like '%Beispieldatensatz%'
    group by n.user_id
  )
  select coalesce(te.user_id, nd.user_id), coalesce(te.entry_days, 0), te.last_entry_at,
         coalesce(nd.nd_count, 0), nd.last_nd_at
  from te full outer join nd on te.user_id = nd.user_id;
$$;

revoke all on function public.superadmin_user_activity() from public, anon, authenticated;
grant execute on function public.superadmin_user_activity() to service_role;

select 'Migration 032 erfolgreich: superadmin_user_activity()' as result;
