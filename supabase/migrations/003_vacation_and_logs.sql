-- Vacation requests
create type vacation_status as enum ('pending', 'approved', 'rejected');

create table public.vacation_requests (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  start_date    date not null,
  end_date      date not null,
  days_count    integer not null default 0,
  reason        text,
  signature_url text,
  status        vacation_status not null default 'pending',
  pdf_url       text,
  email_sent_at timestamptz,
  created_at    timestamptz default now() not null,

  constraint vacation_dates_check check (end_date >= start_date)
);

create index vacation_requests_user_idx on public.vacation_requests (user_id, start_date);

alter table public.vacation_requests enable row level security;

create policy "Users can CRUD own vacation requests"
  on public.vacation_requests for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Daily logs
create table public.daily_logs (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  date       date not null,
  content    text not null,
  tags       text[] not null default '{}',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index daily_logs_user_date_idx on public.daily_logs (user_id, date);

alter table public.daily_logs enable row level security;

create policy "Users can CRUD own daily logs"
  on public.daily_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Activity logs
create table public.activity_logs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  date        date not null,
  title       text not null,
  description text,
  created_at  timestamptz default now() not null
);

alter table public.activity_logs enable row level security;

create policy "Users can CRUD own activity logs"
  on public.activity_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
