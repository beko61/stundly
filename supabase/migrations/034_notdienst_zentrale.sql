-- 034_notdienst_zentrale.sql
-- Notdienst-Zentrale im Firmen-Panel: Pauschale pro Einsatz + Rufbereitschafts-Plan (wer hat welche Woche).
-- Idempotent. Schreiben nur ueber Server-Routen (service_role).

-- 1. Pauschale pro Notdienst-Einsatz (null = nicht festgelegt)
alter table public.companies
  add column if not exists notdienst_pauschale numeric(8,2)
    check (notdienst_pauschale is null or (notdienst_pauschale >= 0 and notdienst_pauschale <= 10000));

comment on column public.companies.notdienst_pauschale is
  'Pauschale in EUR pro Notdienst-Einsatz, von der Firma festgelegt (null = keine).';

-- 2. Rufbereitschafts-Plan: eine Person pro Firma und Woche (Montag)
create table if not exists public.notdienst_rota (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  week_start  date not null check (extract(isodow from week_start) = 1),
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (company_id, week_start)
);

create index if not exists notdienst_rota_user_idx on public.notdienst_rota (user_id, week_start);

alter table public.notdienst_rota enable row level security;

-- Alle Mitglieder der Firma sehen den Plan (Mitarbeiter: "Diese Woche hast du Notdienst")
drop policy if exists "Company members can read rota" on public.notdienst_rota;
create policy "Company members can read rota"
  on public.notdienst_rota for select
  using (company_id = (select p.company_id from public.profiles p where p.user_id = auth.uid()));

select 'Migration 034 erfolgreich: companies.notdienst_pauschale + notdienst_rota' as result;
