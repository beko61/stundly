-- ============================================================
-- Workly: Tüm migration'lar — sırayla
-- Bu dosyayı Supabase SQL Editor'a yapıştır ve Run'a bas
-- Eğer hata olursa: hangi -- === sınırından önce olduğunu söyle
-- ============================================================

-- ===== START: 001_initial_schema.sql =====
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

-- ===== END:   001_initial_schema.sql =====

-- ===== START: 002_time_entries.sql =====
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

-- ===== END:   002_time_entries.sql =====

-- ===== START: 003_vacation_and_logs.sql =====
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

-- ===== END:   003_vacation_and_logs.sql =====

-- ===== START: 004_notdienst_entries.sql =====
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

-- ===== END:   004_notdienst_entries.sql =====

-- ===== START: 005_profiles_mitarbeiter.sql =====
-- Add Mitarbeiter fields to profiles table
alter table public.profiles
  add column if not exists vorname           text,
  add column if not exists nachname          text,
  add column if not exists personal_nr       text,
  add column if not exists eintrittsdatum    text,
  add column if not exists abteilung         text,
  add column if not exists vorgesetzter      text,
  add column if not exists email             text,
  add column if not exists signature_data    text;  -- base64 PNG of saved signature

-- ===== END:   005_profiles_mitarbeiter.sql =====

-- ===== START: 006_notdienst_problem_ergebnis.sql =====
-- Add problem and ergebnis fields to notdienst_entries
alter table public.notdienst_entries
  add column if not exists problem  text,
  add column if not exists ergebnis text;

-- ===== END:   006_notdienst_problem_ergebnis.sql =====

-- ===== START: 007_salary_records.sql =====
-- salary_records: Manuel aylÄ±k brÃ¼t/net maaÅŸ kayÄ±tlarÄ±
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

create policy "salary_records: eigene einfÃ¼gen"
  on public.salary_records for insert
  with check (auth.uid() = user_id);

create policy "salary_records: eigene aktualisieren"
  on public.salary_records for update
  using (auth.uid() = user_id);

create policy "salary_records: eigene lÃ¶schen"
  on public.salary_records for delete
  using (auth.uid() = user_id);

-- ===== END:   007_salary_records.sql =====

-- ===== START: 008_profiles_company.sql =====
-- Add company and regional fields to profiles
alter table public.profiles
  add column if not exists company_name text,
  add column if not exists logo_data    text,       -- base64 PNG/JPEG of company logo
  add column if not exists bundesland   text not null default 'NI';  -- German state code for public holidays

-- ===== END:   008_profiles_company.sql =====

-- ===== START: 009_saas_companies.sql =====
-- ============================================================
-- 009_saas_companies.sql
-- SaaS Multi-Tenant: Åžirket & Abonelik Sistemi (AB/Almanya Uyumlu)
-- ============================================================

-- Plan tÃ¼rleri
create type subscription_plan as enum ('trial', 'individual', 'team', 'business');

-- Abonelik durumu
create type subscription_status as enum ('active', 'trialing', 'past_due', 'canceled', 'incomplete');

-- KullanÄ±cÄ± rolÃ¼ (global)
create type user_role as enum ('super_admin', 'company_admin', 'employee', 'individual');

-- Davet durumu
create type invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');

-- ============================================================
-- COMPANIES â€” Åžirket / mÃ¼ÅŸteri kaydÄ±
-- ============================================================
create table public.companies (
  id                    uuid primary key default uuid_generate_v4(),
  name                  text not null,
  slug                  text unique,                      -- workly.app/company/slug
  logo_url              text,
  country_code          text not null default 'DE',       -- ISO 3166-1 alpha-2
  bundesland            text not null default 'BE',       -- Almanya eyalet kodu (Feiertage iÃ§in)
  vat_id                text,                             -- USt-IdNr. (DE123456789)
  address_line1         text,
  address_line2         text,
  postal_code           text,
  city                  text,
  owner_id              uuid references auth.users(id) on delete set null,
  max_employees         integer not null default 10,      -- plana gÃ¶re limit
  created_at            timestamptz default now() not null,
  updated_at            timestamptz default now() not null
);

create index companies_owner_idx on public.companies (owner_id);

alter table public.companies enable row level security;

-- Åžirket admini kendi ÅŸirketini gÃ¶rebilir
create policy "Company admin can view own company"
  on public.companies for select
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.company_id = companies.id
        and p.role in ('company_admin', 'super_admin')
    )
  );

-- Åžirket admini kendi ÅŸirketini gÃ¼ncelleyebilir
create policy "Company admin can update own company"
  on public.companies for update
  using (owner_id = auth.uid());

-- Yeni ÅŸirket oluÅŸturma (kayÄ±t akÄ±ÅŸÄ±nda)
create policy "Authenticated users can create company"
  on public.companies for insert
  with check (auth.uid() = owner_id);

-- ============================================================
-- SUBSCRIPTIONS â€” Stripe abonelik takibi
-- ============================================================
create table public.subscriptions (
  id                      uuid primary key default uuid_generate_v4(),
  company_id              uuid references public.companies(id) on delete cascade,
  user_id                 uuid references auth.users(id) on delete cascade, -- individual plan iÃ§in
  plan                    subscription_plan not null default 'trial',
  status                  subscription_status not null default 'trialing',
  stripe_customer_id      text unique,
  stripe_subscription_id  text unique,
  stripe_price_id         text,
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  trial_end               timestamptz,
  cancel_at_period_end    boolean not null default false,
  canceled_at             timestamptz,
  -- AB/DSGVO: fatura adresi
  billing_email           text,
  billing_name            text,
  billing_address         jsonb,                          -- {line1, line2, postal_code, city, country}
  vat_number              text,                           -- USt-IdNr.
  -- EUR para birimi zorunlu
  currency                text not null default 'eur',
  created_at              timestamptz default now() not null,
  updated_at              timestamptz default now() not null,

  -- Ya company_id ya user_id olmalÄ±
  constraint subscription_owner_check check (
    (company_id is not null and user_id is null)
    or (company_id is null and user_id is not null)
  )
);

create index subscriptions_company_idx on public.subscriptions (company_id);
create index subscriptions_user_idx on public.subscriptions (user_id);
create index subscriptions_stripe_customer_idx on public.subscriptions (stripe_customer_id);

alter table public.subscriptions enable row level security;

create policy "Users can view own subscription"
  on public.subscriptions for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.companies c
      where c.id = subscriptions.company_id
        and c.owner_id = auth.uid()
    )
  );

-- Stripe webhook service role ile yazar (anon/authenticated yazamaz)
create policy "Service role can manage subscriptions"
  on public.subscriptions for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ============================================================
-- INVITATIONS â€” Ã‡alÄ±ÅŸan davet sistemi
-- ============================================================
create table public.invitations (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid references public.companies(id) on delete cascade not null,
  invited_by      uuid references auth.users(id) on delete set null,
  email           text not null,
  role            user_role not null default 'employee',
  token           text unique not null default encode(gen_random_bytes(32), 'hex'),
  status          invitation_status not null default 'pending',
  expires_at      timestamptz not null default (now() + interval '7 days'),
  accepted_at     timestamptz,
  created_at      timestamptz default now() not null,

  constraint invitations_email_company_unique unique (company_id, email)
);

create index invitations_token_idx on public.invitations (token);
create index invitations_company_idx on public.invitations (company_id);
create index invitations_email_idx on public.invitations (email);

alter table public.invitations enable row level security;

-- Company admin kendi davetlerini gÃ¶rebilir/yÃ¶netebilir
create policy "Company admin can manage invitations"
  on public.invitations for all
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.company_id = invitations.company_id
        and p.role in ('company_admin', 'super_admin')
    )
    or invited_by = auth.uid()
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.company_id = invitations.company_id
        and p.role in ('company_admin', 'super_admin')
    )
  );

-- Token ile davet doÄŸrulama (public â€” kayÄ±tsÄ±z kullanÄ±cÄ± davet linkini aÃ§abilmeli)
create policy "Anyone can view pending invitation by token"
  on public.invitations for select
  using (status = 'pending' and expires_at > now());

-- ============================================================
-- PROFILES tablosuna rol ekleme
-- ============================================================
alter table public.profiles
  add column if not exists role        user_role not null default 'individual',
  add column if not exists plan        subscription_plan not null default 'trial',
  add column if not exists is_active   boolean not null default true,
  add column if not exists last_seen_at timestamptz;

-- company_id foreign key (Ã¶nceki migration'da text'ti, uuid'ye baÄŸlayalÄ±m)
-- Mevcut company_id kolonunu kontrol et
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'profiles_company_id_fkey'
  ) then
    -- Ã–nce mevcut veriyi temizle (geliÅŸtirme ortamÄ±)
    alter table public.profiles
      add constraint profiles_company_id_fkey
      foreign key (company_id) references public.companies(id) on delete set null;
  end if;
end $$;

-- Super admin tÃ¼m profilleri gÃ¶rebilir
create policy "Super admin can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role = 'super_admin'
    )
  );

-- Company admin kendi ÅŸirketinin profillerini gÃ¶rebilir
create policy "Company admin can view company profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role = 'company_admin'
        and p.company_id = profiles.company_id
    )
  );

-- ============================================================
-- AUDIT LOG â€” DSGVO gereÄŸi veri iÅŸleme kaydÄ±
-- ============================================================
create table public.audit_logs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete set null,
  company_id  uuid references public.companies(id) on delete set null,
  action      text not null,           -- 'data_export', 'account_delete', 'login' vb.
  resource    text,                    -- etkilenen tablo/kaynak
  resource_id uuid,
  metadata    jsonb,
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz default now() not null
);

create index audit_logs_user_idx on public.audit_logs (user_id);
create index audit_logs_company_idx on public.audit_logs (company_id);
create index audit_logs_created_idx on public.audit_logs (created_at);

alter table public.audit_logs enable row level security;

-- KullanÄ±cÄ± kendi audit logunu gÃ¶rebilir
create policy "Users can view own audit logs"
  on public.audit_logs for select
  using (user_id = auth.uid());

-- Sadece service role yazabilir
create policy "Service role can insert audit logs"
  on public.audit_logs for insert
  with check (auth.role() = 'service_role');

-- ============================================================
-- GDPR DATA DELETION REQUESTS â€” DSGVO silme talepleri
-- ============================================================
create table public.deletion_requests (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  requested_at  timestamptz default now() not null,
  scheduled_for timestamptz default (now() + interval '30 days') not null,
  completed_at  timestamptz,
  reason        text,
  status        text not null default 'pending'  -- pending, completed, canceled
);

alter table public.deletion_requests enable row level security;

create policy "Users can manage own deletion requests"
  on public.deletion_requests for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- UPDATED_AT TRIGGER â€” companies & subscriptions iÃ§in
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_companies_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ============================================================
-- handle_new_user trigger gÃ¼ncellemesi
-- KayÄ±t sÄ±rasÄ±nda role ve plan set edilsin
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_role        user_role;
  v_company_id  uuid;
begin
  -- Metadata'dan rol al (invitation flow'dan gelir), yoksa 'individual'
  v_role := coalesce(
    (new.raw_user_meta_data->>'role')::user_role,
    'individual'
  );

  -- Davet varsa company_id al
  v_company_id := (new.raw_user_meta_data->>'company_id')::uuid;

  insert into public.profiles (
    user_id,
    full_name,
    role,
    company_id,
    plan
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    v_role,
    v_company_id,
    'trial'
  );

  return new;
end;
$$;

-- ===== END:   009_saas_companies.sql =====

-- ===== START: 010_saas_plans_and_limits.sql =====
-- ============================================================
-- 010_saas_plans_and_limits.sql
-- Plan limitleri & Ã¶zellik kontrolÃ¼
-- ============================================================

-- Plan konfigÃ¼rasyonu tablosu
create table public.plan_features (
  plan                  subscription_plan primary key,
  display_name_de       text not null,           -- Almanca plan adÄ±
  display_name_en       text not null,
  price_monthly_eur     numeric(8,2) not null,   -- EUR, MwSt hariÃ§ (netto)
  price_yearly_eur      numeric(8,2) not null,
  max_employees         integer,                  -- null = sÄ±nÄ±rsÄ±z
  max_storage_mb        integer not null default 500,
  has_company_admin     boolean not null default false,
  has_pdf_export        boolean not null default true,
  has_api_access        boolean not null default false,
  has_ai_features       boolean not null default false,
  has_custom_reports    boolean not null default false,
  has_priority_support  boolean not null default false,
  stripe_price_id_monthly text,
  stripe_price_id_yearly  text,
  created_at            timestamptz default now() not null
);

-- RLS: herkes okuyabilir (pricing sayfasÄ± iÃ§in)
alter table public.plan_features enable row level security;

create policy "Anyone can view plan features"
  on public.plan_features for select
  using (true);

-- Sadece super admin yazabilir
create policy "Super admin can manage plan features"
  on public.plan_features for all
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'super_admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'super_admin'
    )
  );

-- VarsayÄ±lan planlar (EUR, MwSt hariÃ§)
insert into public.plan_features (
  plan, display_name_de, display_name_en,
  price_monthly_eur, price_yearly_eur,
  max_employees, max_storage_mb,
  has_company_admin, has_pdf_export, has_api_access,
  has_ai_features, has_custom_reports, has_priority_support
) values
  (
    'trial',
    'Kostenlos testen',
    'Free Trial',
    0, 0,
    1, 100,
    false, true, false, false, false, false
  ),
  (
    'individual',
    'Einzelperson',
    'Individual',
    9.99, 99.00,
    1, 500,
    false, true, false, false, false, false
  ),
  (
    'team',
    'Team',
    'Team',
    29.99, 299.00,
    10, 5000,
    true, true, false, true, false, true
  ),
  (
    'business',
    'Unternehmen',
    'Business',
    79.99, 799.00,
    null, 50000,
    true, true, true, true, true, true
  );

-- ============================================================
-- Plan limit kontrolÃ¼ â€” Ã§alÄ±ÅŸan eklenebilir mi?
-- ============================================================
create or replace function public.check_employee_limit(p_company_id uuid)
returns boolean language plpgsql security definer as $$
declare
  v_max_employees integer;
  v_current_count integer;
  v_plan          subscription_plan;
begin
  -- Åžirketin aktif planÄ±nÄ± al
  select s.plan into v_plan
  from public.subscriptions s
  where s.company_id = p_company_id
    and s.status in ('active', 'trialing')
  order by s.created_at desc
  limit 1;

  if v_plan is null then
    v_plan := 'trial';
  end if;

  -- PlanÄ±n max Ã§alÄ±ÅŸan limitini al
  select pf.max_employees into v_max_employees
  from public.plan_features pf
  where pf.plan = v_plan;

  -- null = sÄ±nÄ±rsÄ±z
  if v_max_employees is null then
    return true;
  end if;

  -- Mevcut Ã§alÄ±ÅŸan sayÄ±sÄ±
  select count(*) into v_current_count
  from public.profiles p
  where p.company_id = p_company_id
    and p.is_active = true;

  return v_current_count < v_max_employees;
end;
$$;

-- ============================================================
-- Stripe webhook log (debug & DSGVO kayÄ±t iÃ§in)
-- ============================================================
create table public.stripe_webhook_events (
  id            uuid primary key default uuid_generate_v4(),
  stripe_event_id text unique not null,
  event_type    text not null,
  processed     boolean not null default false,
  error         text,
  payload       jsonb,
  created_at    timestamptz default now() not null
);

alter table public.stripe_webhook_events enable row level security;

-- Sadece service role eriÅŸebilir
create policy "Service role only"
  on public.stripe_webhook_events for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ===== END:   010_saas_plans_and_limits.sql =====

-- ===== START: 011_fix_apply_saas_schema.sql =====
-- ============================================================
-- 011_fix_apply_saas_schema.sql
-- 009 + 010 migrationlarÄ±nÄ±n idempotent (tekrar Ã§alÄ±ÅŸtÄ±rÄ±labilir) versiyonu
-- Supabase SQL Editor'da Ã§alÄ±ÅŸtÄ±r
-- ============================================================

-- ============================================================
-- 1. ENUM TYPES (yoksa oluÅŸtur)
-- ============================================================
do $$ begin
  create type subscription_plan as enum ('trial', 'individual', 'team', 'business');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type subscription_status as enum ('active', 'trialing', 'past_due', 'canceled', 'incomplete');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type user_role as enum ('super_admin', 'company_admin', 'employee', 'individual');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');
exception when duplicate_object then null;
end $$;

-- ============================================================
-- 2. COMPANIES TABLOSU
-- ============================================================
create table if not exists public.companies (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  slug          text unique,
  logo_url      text,
  country_code  text not null default 'DE',
  bundesland    text not null default 'BE',
  vat_id        text,
  address_line1 text,
  address_line2 text,
  postal_code   text,
  city          text,
  owner_id      uuid references auth.users(id) on delete set null,
  max_employees integer not null default 10,
  created_at    timestamptz default now() not null,
  updated_at    timestamptz default now() not null
);

create index if not exists companies_owner_idx on public.companies (owner_id);

alter table public.companies enable row level security;

do $$ begin
  create policy "Company admin can view own company"
    on public.companies for select
    using (
      owner_id = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid()
          and p.company_id = companies.id
      )
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Company admin can update own company"
    on public.companies for update
    using (owner_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can create company"
    on public.companies for insert
    with check (auth.uid() = owner_id);
exception when duplicate_object then null;
end $$;

-- ============================================================
-- 3. SUBSCRIPTIONS TABLOSU
-- ============================================================
create table if not exists public.subscriptions (
  id                      uuid primary key default uuid_generate_v4(),
  company_id              uuid references public.companies(id) on delete cascade,
  user_id                 uuid references auth.users(id) on delete cascade,
  plan                    subscription_plan not null default 'trial',
  status                  subscription_status not null default 'trialing',
  stripe_customer_id      text unique,
  stripe_subscription_id  text unique,
  stripe_price_id         text,
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  trial_end               timestamptz,
  cancel_at_period_end    boolean not null default false,
  canceled_at             timestamptz,
  billing_email           text,
  billing_name            text,
  billing_address         jsonb,
  vat_number              text,
  currency                text not null default 'eur',
  created_at              timestamptz default now() not null,
  updated_at              timestamptz default now() not null
);

create index if not exists subscriptions_company_idx on public.subscriptions (company_id);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id);

alter table public.subscriptions enable row level security;

do $$ begin
  create policy "Users can view own subscription"
    on public.subscriptions for select
    using (
      user_id = auth.uid()
      or exists (
        select 1 from public.companies c
        where c.id = subscriptions.company_id and c.owner_id = auth.uid()
      )
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Service role can manage subscriptions"
    on public.subscriptions for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');
exception when duplicate_object then null;
end $$;

-- ============================================================
-- 4. INVITATIONS TABLOSU
-- ============================================================
create table if not exists public.invitations (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid references public.companies(id) on delete cascade not null,
  invited_by  uuid references auth.users(id) on delete set null,
  email       text not null,
  role        user_role not null default 'employee',
  token       text unique not null default encode(gen_random_bytes(32), 'hex'),
  status      invitation_status not null default 'pending',
  expires_at  timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at  timestamptz default now() not null,
  constraint invitations_email_company_unique unique (company_id, email)
);

create index if not exists invitations_token_idx on public.invitations (token);
create index if not exists invitations_company_idx on public.invitations (company_id);

alter table public.invitations enable row level security;

do $$ begin
  create policy "Company admin can manage invitations"
    on public.invitations for all
    using (
      exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid() and p.company_id = invitations.company_id
      )
      or invited_by = auth.uid()
    )
    with check (
      exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid() and p.company_id = invitations.company_id
      )
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Anyone can view pending invitation by token"
    on public.invitations for select
    using (status = 'pending' and expires_at > now());
exception when duplicate_object then null;
end $$;

-- ============================================================
-- 5. AUDIT LOGS TABLOSU
-- ============================================================
create table if not exists public.audit_logs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete set null,
  company_id  uuid references public.companies(id) on delete set null,
  action      text not null,
  resource    text,
  resource_id uuid,
  metadata    jsonb,
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz default now() not null
);

alter table public.audit_logs enable row level security;

do $$ begin
  create policy "Users can view own audit logs"
    on public.audit_logs for select using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Service role can insert audit logs"
    on public.audit_logs for insert with check (auth.role() = 'service_role');
exception when duplicate_object then null;
end $$;

-- ============================================================
-- 6. DELETION REQUESTS TABLOSU
-- ============================================================
create table if not exists public.deletion_requests (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  requested_at  timestamptz default now() not null,
  scheduled_for timestamptz default (now() + interval '30 days') not null,
  completed_at  timestamptz,
  reason        text,
  status        text not null default 'pending'
);

alter table public.deletion_requests enable row level security;

do $$ begin
  create policy "Users can manage own deletion requests"
    on public.deletion_requests for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

-- ============================================================
-- 7. PROFILES TABLOSUNA KOLONLAR EKLE
-- ============================================================
alter table public.profiles
  add column if not exists role         user_role not null default 'individual',
  add column if not exists plan         subscription_plan not null default 'trial',
  add column if not exists is_active    boolean not null default true,
  add column if not exists last_seen_at timestamptz,
  add column if not exists company_id   uuid references public.companies(id) on delete set null;

-- Mevcut kullanÄ±cÄ±larÄ±n email'lerini profiles tablosuna ekle (yoksa)
update public.profiles p
set email = u.email
from auth.users u
where p.user_id = u.id and (p.email is null or p.email = '');

-- ============================================================
-- 8. PLAN FEATURES TABLOSU
-- ============================================================
create table if not exists public.plan_features (
  plan                    subscription_plan primary key,
  display_name_de         text not null,
  display_name_en         text not null,
  price_monthly_eur       numeric(8,2) not null,
  price_yearly_eur        numeric(8,2) not null,
  max_employees           integer,
  max_storage_mb          integer not null default 500,
  has_company_admin       boolean not null default false,
  has_pdf_export          boolean not null default true,
  has_api_access          boolean not null default false,
  has_ai_features         boolean not null default false,
  has_custom_reports      boolean not null default false,
  has_priority_support    boolean not null default false,
  stripe_price_id_monthly text,
  stripe_price_id_yearly  text,
  created_at              timestamptz default now() not null
);

alter table public.plan_features enable row level security;

do $$ begin
  create policy "Anyone can view plan features"
    on public.plan_features for select using (true);
exception when duplicate_object then null;
end $$;

-- VarsayÄ±lan planlarÄ± ekle (yoksa)
insert into public.plan_features (
  plan, display_name_de, display_name_en,
  price_monthly_eur, price_yearly_eur,
  max_employees, max_storage_mb,
  has_company_admin, has_pdf_export, has_api_access,
  has_ai_features, has_custom_reports, has_priority_support
) values
  ('trial',      'Kostenlos testen', 'Free Trial',  0,     0,      1,    100,   false, true, false, false, false, false),
  ('individual', 'Einzelperson',     'Individual',  9.99,  99.00,  1,    500,   false, true, false, false, false, false),
  ('team',       'Team',             'Team',        29.99, 299.00, 10,   5000,  true,  true, false, true,  false, true),
  ('business',   'Unternehmen',      'Business',    79.99, 799.00, null, 50000, true,  true, true,  true,  true,  true)
on conflict (plan) do nothing;

-- ============================================================
-- 9. STRIPE WEBHOOK LOG TABLOSU
-- ============================================================
create table if not exists public.stripe_webhook_events (
  id              uuid primary key default uuid_generate_v4(),
  stripe_event_id text unique not null,
  event_type      text not null,
  processed       boolean not null default false,
  error           text,
  payload         jsonb,
  created_at      timestamptz default now() not null
);

alter table public.stripe_webhook_events enable row level security;

do $$ begin
  create policy "Service role only for stripe events"
    on public.stripe_webhook_events for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');
exception when duplicate_object then null;
end $$;

-- ============================================================
-- 10. UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_companies_updated_at on public.companies;
create trigger set_companies_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ============================================================
-- 11. handle_new_user TRIGGER (gÃ¼ncelle)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_role       user_role;
  v_company_id uuid;
begin
  v_role := coalesce(
    (new.raw_user_meta_data->>'role')::user_role,
    'individual'
  );
  v_company_id := (new.raw_user_meta_data->>'company_id')::uuid;

  insert into public.profiles (user_id, full_name, email, role, company_id, plan)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    v_role,
    v_company_id,
    'trial'
  )
  on conflict (user_id) do update set
    full_name = excluded.full_name,
    role      = excluded.role;

  return new;
end;
$$;

-- Trigger'Ä± yeniden oluÅŸtur
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 12. SUPER ADMIN RLS â€” Service role bypass
-- ============================================================
do $$ begin
  create policy "Service role full access profiles"
    on public.profiles for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Service role full access companies"
    on public.companies for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');
exception when duplicate_object then null;
end $$;

-- ============================================================
-- TAMAMLANDI
-- Åžimdi /setup sayfasÄ±na giderek super_admin rolÃ¼nÃ¼ al
-- ============================================================
select 'Migration 011 baÅŸarÄ±yla tamamlandÄ±!' as result;

-- ===== END:   011_fix_apply_saas_schema.sql =====


