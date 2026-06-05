-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles (extends auth.users)
create table public.profiles (
  id                   uuid primary key default uuid_generate_v4(),
  user_id              uuid references auth.users(id) on delete cascade not null unique,
  full_name            text,
  hourly_rate          numeric(10,2) default 15,
  monthly_target_hours numeric(6,2)  default 160,
  company_id           uuid,  -- nullable, for Phase 2 multi-tenant
  created_at           timestamptz default now() not null,
  updated_at           timestamptz default now() not null
);

-- RLS
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = user_id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
