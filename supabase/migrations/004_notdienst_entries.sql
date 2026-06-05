-- Notdienst sub-entries (multiple per day)
create table public.notdienst_entries (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  date        date not null,
  start_time  time not null,
  end_time    time not null,
  note        text,
  kunde       text,
  adresse     text,
  erledigt    boolean not null default false,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

create index notdienst_entries_user_date_idx on public.notdienst_entries (user_id, date);

alter table public.notdienst_entries enable row level security;

create policy "Users can CRUD own notdienst entries"
  on public.notdienst_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
