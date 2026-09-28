-- ============================================================
-- 029_notdienst_anhaenge.sql
-- Fotos + Kundenunterschrift zu einem Notdienst-Einsatz (v0.62.0).
--
-- Eigene Tabelle statt Spalten in notdienst_entries: die Monatsliste im
-- Tracker laedt notdienst_entries mit select(*) — Bilder (je ~100 KB) sollen
-- nur geladen werden, wenn ein einzelner Einsatz geoeffnet wird.
--
-- Speicherung als Data-URL (text), wie profiles.logo_data / signature_data:
-- kein Storage-Bucket noetig, Loeschung laeuft per ON DELETE CASCADE mit dem
-- Einsatz bzw. dem Konto (DSGVO), und der Export (select *) enthaelt sie.
--
-- Idempotent — kann gefahrlos mehrfach ausgefuehrt werden.
-- ============================================================

create table if not exists public.notdienst_anhaenge (
  id            uuid primary key default gen_random_uuid(),
  notdienst_id  uuid not null references public.notdienst_entries(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade default auth.uid(),
  art           text not null check (art in ('foto', 'unterschrift')),
  -- data:image/jpeg;base64,... bzw. data:image/png;base64,... — max ~1,5 MB
  data          text not null check (data like 'data:image/%' and length(data) <= 1600000),
  -- nur bei art = unterschrift: Name der unterschreibenden Person
  unterzeichner text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_notdienst_anhaenge_notdienst
  on public.notdienst_anhaenge (notdienst_id, created_at);

-- Hoechstens eine Kundenunterschrift pro Einsatz
create unique index if not exists uq_notdienst_anhaenge_unterschrift
  on public.notdienst_anhaenge (notdienst_id) where art = 'unterschrift';

alter table public.notdienst_anhaenge enable row level security;

-- Eigene Anhaenge: lesen / anlegen / loeschen — nur zu eigenen Einsaetzen
drop policy if exists "Users can read own notdienst attachments" on public.notdienst_anhaenge;
create policy "Users can read own notdienst attachments"
  on public.notdienst_anhaenge for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own notdienst attachments" on public.notdienst_anhaenge;
create policy "Users can insert own notdienst attachments"
  on public.notdienst_anhaenge for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.notdienst_entries n
      where n.id = notdienst_id and n.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete own notdienst attachments" on public.notdienst_anhaenge;
create policy "Users can delete own notdienst attachments"
  on public.notdienst_anhaenge for delete
  using (auth.uid() = user_id);

-- Firmen-Admin darf die Anhaenge seines Teams lesen (analog 015 fuer notdienst_entries)
drop policy if exists "Company admin can view team notdienst attachments" on public.notdienst_anhaenge;
create policy "Company admin can view team notdienst attachments"
  on public.notdienst_anhaenge for select
  using (public.is_company_member_of_admin(user_id));
