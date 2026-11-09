-- ============================================================
-- 041_notdienst_zahlung_bestaetigen.sql — Notdienst-Zahlung von beiden Seiten bestätigt
--
-- Firmen-Mitarbeiter: 1) Firma markiert "überwiesen" (ueberwiesen_am)  2) Mitarbeiter bestätigt "erhalten"
-- → erst dann erledigt = true (= bezahlt; Lohn, Berichte, PDF zählen weiter erledigt).
-- Beide Schritte laufen über Server-Routen (service_role): /api/company/notdienst/[id] und
-- /api/notdienst/[id]/erhalten. Der Mitarbeiter darf weder erledigt noch ueberwiesen_am direkt ändern.
-- Einzelpersonen (ohne Firma) unverändert: sie setzen erledigt selbst.
--
-- Nur Ergänzung (neue Spalte + erweiterter Schutz) — kann vor dem Code-Deploy laufen. Idempotent.
-- Rückgängig: alter table public.notdienst_entries drop column if exists ueberwiesen_am;
--             (+ guard_notdienst_paid aus 033 wiederherstellen)
-- ============================================================

alter table public.notdienst_entries
  add column if not exists ueberwiesen_am timestamptz;

comment on column public.notdienst_entries.ueberwiesen_am is
  'Firma hat die Notdienst-Zahlung als ueberwiesen markiert; bezahlt (erledigt) erst nach Bestaetigung durch den Mitarbeiter.';

-- Bisher von der Firma als bezahlt markierte Einsätze: gelten als überwiesen + bestätigt
update public.notdienst_entries
   set ueberwiesen_am = coalesce(ueberwiesen_am, now())
 where erledigt = true and ueberwiesen_am is null;

create or replace function public.guard_notdienst_paid()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if (new.erledigt is distinct from old.erledigt or new.ueberwiesen_am is distinct from old.ueberwiesen_am)
     and exists (
       select 1 from public.profiles p
       where p.user_id = new.user_id and p.company_id is not null and p.role = 'employee'
     ) then
    raise exception 'Den Bezahlt-Status setzt deine Firma';
  end if;
  return new;
end;
$$;

select 'Migration 041 erfolgreich: notdienst_entries.ueberwiesen_am + Schutz.' as result;
