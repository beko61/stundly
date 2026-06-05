-- Day type enum
create type day_type as enum (
  'arbeiten', 'urlaub', 'krank', 'notdienst', 'feiertag', 'frei'
);

-- Time entries
create table public.time_entries (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  date           date not null,
  start_time     time,
  end_time       time,
  break_minutes  integer not null default 0,
  day_type       day_type not null default 'arbeiten',
  is_night_shift boolean not null default false,
  note           text,
  tags           text[] not null default '{}',
  synced_at      timestamptz,
  created_at     timestamptz default now() not null,
  updated_at     timestamptz default now() not null,

  -- One entry per user per date
  constraint time_entries_user_date_unique unique (user_id, date)
);

create index time_entries_user_date_idx on public.time_entries (user_id, date);

-- RLS
alter table public.time_entries enable row level security;

create policy "Users can CRUD own time entries"
  on public.time_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Salary settings
create table public.salary_settings (
  id                       uuid primary key default uuid_generate_v4(),
  user_id                  uuid references auth.users(id) on delete cascade not null,
  hourly_rate              numeric(10,2) not null default 15,
  overtime_rate_multiplier numeric(4,2)  not null default 1.25,
  night_shift_bonus        numeric(10,2) not null default 3,
  notdienst_bonus          numeric(10,2) not null default 50,
  monthly_target_hours     numeric(6,2)  not null default 160,
  valid_from               date not null default current_date,
  created_at               timestamptz default now() not null
);

alter table public.salary_settings enable row level security;

create policy "Users can CRUD own salary settings"
  on public.salary_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
