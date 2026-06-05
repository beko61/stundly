-- salary_records: Manuel aylık brüt/net maaş kayıtları
create table if not exists public.salary_records (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  year       int  not null,
  month      int  not null check (month between 1 and 12),
  brutto     numeric(10,2) not null default 0,
  netto      numeric(10,2) not null default 0,
  note       text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, year, month)
);

alter table public.salary_records enable row level security;

create policy "salary_records: eigene lesen"
  on public.salary_records for select
  using (auth.uid() = user_id);

create policy "salary_records: eigene einfügen"
  on public.salary_records for insert
  with check (auth.uid() = user_id);

create policy "salary_records: eigene aktualisieren"
  on public.salary_records for update
  using (auth.uid() = user_id);

create policy "salary_records: eigene löschen"
  on public.salary_records for delete
  using (auth.uid() = user_id);
