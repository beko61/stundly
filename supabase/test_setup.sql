-- ============================================================
-- test_setup.sql — NUR für das Test-Projekt (stundly-test), NIE in der Live-Datenbank ausführen!
-- Alle Migrationen 001–037 in Reihenfolge (009/010 übersprungen, 011 ersetzt sie).
-- Erzeugt aus supabase/migrations/ — bei neuen Migrationen neu erzeugen.
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
-- ===== END: 001_initial_schema.sql =====

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
-- ===== END: 002_time_entries.sql =====

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
-- ===== END: 003_vacation_and_logs.sql =====

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
-- ===== END: 004_notdienst_entries.sql =====

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
-- ===== END: 005_profiles_mitarbeiter.sql =====

-- ===== START: 006_notdienst_problem_ergebnis.sql =====
-- Add problem and ergebnis fields to notdienst_entries
alter table public.notdienst_entries
  add column if not exists problem  text,
  add column if not exists ergebnis text;
-- ===== END: 006_notdienst_problem_ergebnis.sql =====

-- ===== START: 007_salary_records.sql =====
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
-- ===== END: 007_salary_records.sql =====

-- ===== START: 008_profiles_company.sql =====
-- Add company and regional fields to profiles
alter table public.profiles
  add column if not exists company_name text,
  add column if not exists logo_data    text,       -- base64 PNG/JPEG of company logo
  add column if not exists bundesland   text not null default 'NI';  -- German state code for public holidays
-- ===== END: 008_profiles_company.sql =====

-- ===== START: 011_fix_apply_saas_schema.sql =====
-- ============================================================
-- 011_fix_apply_saas_schema.sql
-- 009 + 010 migrationlarının idempotent (tekrar çalıştırılabilir) versiyonu
-- Supabase SQL Editor'da çalıştır
-- ============================================================

-- ============================================================
-- 1. ENUM TYPES (yoksa oluştur)
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

-- Mevcut kullanıcıların email'lerini profiles tablosuna ekle (yoksa)
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

-- Varsayılan planları ekle (yoksa)
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
-- 11. handle_new_user TRIGGER (güncelle)
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

-- Trigger'ı yeniden oluştur
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 12. SUPER ADMIN RLS — Service role bypass
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
-- Şimdi /setup sayfasına giderek super_admin rolünü al
-- ============================================================
select 'Migration 011 başarıyla tamamlandı!' as result;
-- ===== END: 011_fix_apply_saas_schema.sql =====

-- ===== START: 012_salary_tax_settings.sql =====
-- ============================================================
-- 012_salary_tax_settings.sql
-- salary_settings tablosuna Almanya vergi hesaplama alanları
-- (Steuerklasse, Kirchensteuer, Kind, Manuel mod)
-- Idempotent — defalarca çalıştırılabilir
-- ============================================================

alter table public.salary_settings
  add column if not exists steuerklasse    text default 'I'
    check (steuerklasse in ('I', 'II', 'III', 'IV', 'V', 'VI')),
  add column if not exists kirchensteuer   numeric(4,3) default 0
    check (kirchensteuer in (0, 0.08, 0.09)),
  add column if not exists hat_kinder      boolean default false,
  add column if not exists tax_mode        text default 'auto'
    check (tax_mode in ('auto', 'manual')),
  add column if not exists manuell_abzug   numeric(5,2) default 0
    check (manuell_abzug >= 0 and manuell_abzug <= 100);

comment on column public.salary_settings.steuerklasse  is 'Lohnsteuerklasse I-VI (default I)';
comment on column public.salary_settings.kirchensteuer is '0=keine, 0.08=BW/BY, 0.09=übrige Bundesländer';
comment on column public.salary_settings.hat_kinder    is 'Kind im Haushalt (Pflegeversicherung 1.7% vs 2.35%)';
comment on column public.salary_settings.tax_mode      is 'auto=echte Berechnung, manual=fixer % Abzug';
comment on column public.salary_settings.manuell_abzug is 'Prozent Abzug bei tax_mode=manual (0-100)';

select 'Migration 012 başarıyla tamamlandı: vergi alanları eklendi.' as result;
-- ===== END: 012_salary_tax_settings.sql =====

-- ===== START: 013_urlaub_anspruch.sql =====
-- ============================================================
-- 013_urlaub_anspruch.sql
-- salary_settings tablosuna yıllık Urlaub hak günü alanı ekler.
-- Default 30 (Almanya tam yıllık sözleşmeli çalışan ortalaması).
-- Idempotent — defalarca çalıştırılabilir.
-- ============================================================

alter table public.salary_settings
  add column if not exists urlaub_anspruch int default 30
    check (urlaub_anspruch >= 0 and urlaub_anspruch <= 60);

comment on column public.salary_settings.urlaub_anspruch is
  'Jährlicher Urlaubsanspruch in Tagen (Default 30, Bandbreite 0-60).';

select 'Migration 013 başarıyla tamamlandı: urlaub_anspruch eklendi.' as result;
-- ===== END: 013_urlaub_anspruch.sql =====

-- ===== START: 014_firma_adresse.sql =====
-- ============================================================
-- 014_firma_adresse.sql
-- profiles tablosuna firma adres alanları ekler (PDF için).
-- Urlaubsantrag PDF'i ve aylık raporlar bu bilgileri kullanır.
-- Idempotent — defalarca çalıştırılabilir.
-- ============================================================

alter table public.profiles
  add column if not exists firma_strasse  text,
  add column if not exists firma_plz      text,
  add column if not exists firma_ort      text,
  add column if not exists firma_telefon  text;

comment on column public.profiles.firma_strasse is 'Firma Straße + Hausnummer (z.B. "Tiergarten 122")';
comment on column public.profiles.firma_plz     is 'Firma Postleitzahl (z.B. "30559")';
comment on column public.profiles.firma_ort     is 'Firma Stadt / Ort (z.B. "Hannover")';
comment on column public.profiles.firma_telefon is 'Firma Telefonnummer (optional, für PDF Briefkopf)';

select 'Migration 014 başarıyla tamamlandı: firma adres alanları eklendi.' as result;
-- ===== END: 014_firma_adresse.sql =====

-- ===== START: 015_company_admin_read_access.sql =====
-- ============================================================
-- 015_company_admin_read_access.sql
-- Company admin can SELECT team members' time/vacation/notdienst data
-- ------------------------------------------------------------
-- Why: Önceki RLS'ler (003, 004, 002) sadece "auth.uid() = user_id" izin verdi.
-- Şirket modunda admin, kendi şirketindeki tüm mitarbeiter'in time_entries,
-- vacation_requests, notdienst_entries kayıtlarını GÖRMELİ (read-only).
-- Yazma yetkisi (insert/update/delete) hâlâ sadece sahip user'da.
--
-- Bu migration idempotent: policy'ler "if not exists" benzeri "drop then create"
-- pattern ile yeniden uygulanabilir.
-- ============================================================

-- Helper: belirtilen user_id, çağıran admin'in şirketinde mi?
create or replace function public.is_company_member_of_admin(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p_admin
    join public.profiles p_target on p_target.company_id = p_admin.company_id
    where p_admin.user_id = auth.uid()
      and p_admin.role in ('company_admin', 'super_admin')
      and p_admin.company_id is not null
      and p_target.user_id = target_user
  );
$$;

grant execute on function public.is_company_member_of_admin(uuid) to authenticated;

-- ============================================================
-- time_entries — admin read access
-- ============================================================
drop policy if exists "Company admin can view team time entries" on public.time_entries;
create policy "Company admin can view team time entries"
  on public.time_entries
  for select
  using (public.is_company_member_of_admin(user_id));

-- ============================================================
-- vacation_requests — admin read access (approve/reject F4'te eklenecek)
-- ============================================================
drop policy if exists "Company admin can view team vacation requests" on public.vacation_requests;
create policy "Company admin can view team vacation requests"
  on public.vacation_requests
  for select
  using (public.is_company_member_of_admin(user_id));

-- ============================================================
-- notdienst_entries — admin read access
-- (varsa — yoksa hata vermesin: bu blok try/catch ile sarılır)
-- ============================================================
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'notdienst_entries') then
    execute 'drop policy if exists "Company admin can view team notdienst" on public.notdienst_entries';
    execute 'create policy "Company admin can view team notdienst" on public.notdienst_entries for select using (public.is_company_member_of_admin(user_id))';
  end if;
end $$;

-- ============================================================
-- daily_logs — admin read access
-- ============================================================
drop policy if exists "Company admin can view team daily logs" on public.daily_logs;
create policy "Company admin can view team daily logs"
  on public.daily_logs
  for select
  using (public.is_company_member_of_admin(user_id));

-- ============================================================
-- salary_records — admin read access (varsa)
-- ============================================================
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'salary_records') then
    execute 'drop policy if exists "Company admin can view team salary records" on public.salary_records';
    execute 'create policy "Company admin can view team salary records" on public.salary_records for select using (public.is_company_member_of_admin(user_id))';
  end if;
end $$;
-- ===== END: 015_company_admin_read_access.sql =====

-- ===== START: 016_vacation_urlaub_art_vertretung.sql =====
-- ============================================================
-- 016_vacation_urlaub_art_vertretung.sql
-- vacation_requests tablosuna iki alan ekler:
--   urlaub_art  Erholungsurlaub / Sonderurlaub / Bildungsurlaub /
--               Unbezahlter Urlaub / Elternzeit / Überstundenabbau
--   vertretung  Yerini alacak kişi (Vertretung) — Handwerk standardı
-- Idempotent — defalarca çalıştırılabilir.
-- ============================================================

alter table public.vacation_requests
  add column if not exists urlaub_art text default 'Erholungsurlaub',
  add column if not exists vertretung text;

comment on column public.vacation_requests.urlaub_art is
  'Urlaubstyp: Erholungsurlaub / Sonderurlaub / Bildungsurlaub / Unbezahlter Urlaub / Elternzeit / Überstundenabbau.';
comment on column public.vacation_requests.vertretung is
  'Vertretung waehrend Abwesenheit (optional, freitext).';

select 'Migration 016 basarili: urlaub_art + vertretung eklendi.' as result;
-- ===== END: 016_vacation_urlaub_art_vertretung.sql =====

-- ===== START: 017_vacation_approval_fields.sql =====
-- ============================================================
-- 017_vacation_approval_fields.sql
-- vacation_requests tablosuna karar (Entscheidung) alanları ekler:
--   approved_at        ne zaman onaylandı
--   approved_by        kim onayladı (uuid → auth.users)
--   rejected_at        ne zaman reddedildi
--   rejection_reason   ret gerekçesi (opsiyonel)
--
-- Ek RLS politikası: company_admin (veya super_admin) AYNI ŞİRKETTEKİ
-- çalışanların vacation_requests kayıtlarını UPDATE edebilir.
-- Bu sayede F4 admin approval UI çalışır.
--
-- Idempotent — defalarca çalıştırılabilir.
-- ============================================================

alter table public.vacation_requests
  add column if not exists approved_at      timestamptz,
  add column if not exists approved_by      uuid references auth.users(id) on delete set null,
  add column if not exists rejected_at      timestamptz,
  add column if not exists rejection_reason text;

comment on column public.vacation_requests.approved_at      is 'Genehmigung-Zeitstempel (UTC).';
comment on column public.vacation_requests.approved_by      is 'Welcher company_admin hat genehmigt (auth.users.id).';
comment on column public.vacation_requests.rejected_at      is 'Ablehnung-Zeitstempel (UTC).';
comment on column public.vacation_requests.rejection_reason is 'Begruendung der Ablehnung (optional).';

-- ── RLS: company_admin same-company UPDATE ──
-- Helper function is_company_member_of_admin() Migration 015'te eklendi.
-- Eski policy 'Users can CRUD own vacation requests' user_id eşitliği gerektiriyor.
-- Bu policy onu KAPSAMAZ; admin kendi user_id'siyle UPDATE etmez.
-- Yeni policy ek olarak admin'in aynı şirketteki çalışanın kaydını UPDATE etmesine izin verir.

drop policy if exists "Company admin can update team vacations" on public.vacation_requests;
create policy "Company admin can update team vacations"
  on public.vacation_requests for update
  using (
    public.is_company_member_of_admin(user_id)
  )
  with check (
    public.is_company_member_of_admin(user_id)
  );

select 'Migration 017 basarili: approval alanlari + admin UPDATE policy.' as result;
-- ===== END: 017_vacation_approval_fields.sql =====

-- ===== START: 018_audit_log.sql =====
-- ============================================================
-- 018_audit_log.sql
-- DSGVO + GoBD denetlenebilirlik için audit_log tablosu.
--
-- Saklanan veri:
--   id              uuid pk
--   created_at      timestamptz default now()
--   actor_user_id   uuid — eylemi yapan kullanıcı (genelde company_admin)
--   company_id      uuid — eylemin ait olduğu şirket (RLS scope için)
--   action          text — kısa eylem kimliği (snake_case enum string)
--                          örn: vacation.approved / vacation.rejected /
--                               employee.activated / employee.deactivated
--   resource_type   text — örn: vacation_request / profile
--   resource_id     uuid — etkilenen kayıt id'si (opsiyonel)
--   payload         jsonb — eyleme özgü meta (örn rejection_reason)
--
-- RLS:
--   - super_admin tümünü görür
--   - company_admin sadece kendi şirketinin audit'ini görür
--   - normal user kendi etkilendiği audit'leri görmez (Verschleierungs-Risiko)
--
-- Idempotent — defalarca çalıştırılabilir.
-- ============================================================

create table if not exists public.audit_log (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz not null default now(),
  actor_user_id uuid references auth.users(id) on delete set null,
  company_id    uuid references public.companies(id) on delete cascade,
  action        text not null,
  resource_type text,
  resource_id   uuid,
  payload       jsonb default '{}'::jsonb
);

-- Hızlı sorgu indeksleri
create index if not exists audit_log_company_created_idx
  on public.audit_log (company_id, created_at desc);
create index if not exists audit_log_actor_idx
  on public.audit_log (actor_user_id, created_at desc);
create index if not exists audit_log_resource_idx
  on public.audit_log (resource_type, resource_id);

-- RLS
alter table public.audit_log enable row level security;

drop policy if exists "Company admin can read company audit log" on public.audit_log;
create policy "Company admin can read company audit log"
  on public.audit_log for select
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.company_id = public.audit_log.company_id
        and (p.role = 'company_admin' or p.role = 'super_admin')
    )
  );

-- INSERT/UPDATE/DELETE policy YOK — sadece service-role (server route) yazabilir.
-- Bu bilinçli güvenlik kararı: audit kayıtları yalnızca güvenilir server-tarafından
-- yazılır, kullanıcılar doğrudan ekleyemez/değiştiremez.

comment on table public.audit_log is
  'DSGVO + GoBD denetim kayıtları. Sadece service-role yazar, company_admin okur.';

select 'Migration 018 basarili: audit_log tablosu + RLS policy.' as result;
-- ===== END: 018_audit_log.sql =====

-- ===== START: 019_profiles_soft_delete.sql =====
-- ============================================================
-- 019_profiles_soft_delete.sql
-- Soft-delete altyapısı: profiles tablosuna deleted_at ekler.
--
-- Neden hard-delete yerine soft-delete:
--   - GoBD: time_entries 10 yıl saklanmalı (Mitarbeiter silinse bile)
--   - DSGVO: kullanıcı silme isteği farklı endpoint'le karşılanır
--             (/api/dsgvo/delete — gerçek silme + anonymize)
--   - Audit: kim ne zaman sildi izlenebilsin
--   - Restore: kazara silmede geri al
--
-- Soft-delete davranışı:
--   - profile.deleted_at = now() set edilir
--   - profile.is_active = false set edilir (login engellenir)
--   - time_entries, vacation_requests, notdienst_entries DOKUNULMAZ
--   - Tüm sorgu filtreleri "where deleted_at is null" eklemeli
--
-- Idempotent.
-- ============================================================

alter table public.profiles
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

-- Aktif mitarbeiter filter index'i (deleted_at is null daha verimli)
create index if not exists profiles_active_idx
  on public.profiles (company_id)
  where deleted_at is null;

comment on column public.profiles.deleted_at is
  'Soft-delete tarihi. null = aktif. Set ise mitarbeiter tüm UI listelerinden filtrelenir.';
comment on column public.profiles.deleted_by is
  'Company admin who soft-deleted this profile (auth.users.id).';

select 'Migration 019 basarili: deleted_at + deleted_by + active index.' as result;
-- ===== END: 019_profiles_soft_delete.sql =====

-- ===== START: 020_profiles_must_change_password.sql =====
-- ============================================================
-- 020_profiles_must_change_password.sql
-- Direkt Mitarbeiter erstellen akışı için must_change_password flag.
--
-- Mantık:
--   - Admin mitarbeiter'i direkt oluştururken geçici şifre belirler.
--   - profiles.must_change_password = true set edilir.
--   - Mitarbeiter ilk login'de /password-change sayfasına zorla yönlendirilir.
--   - Şifre değişince must_change_password = false yapılır.
--
-- Idempotent.
-- ============================================================

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

comment on column public.profiles.must_change_password is
  'true ise: ilk login sonrası /password-change sayfasına zorla yönlendirilir. Şifre değişince false olur.';

select 'Migration 020 basarili: must_change_password eklendi.' as result;
-- ===== END: 020_profiles_must_change_password.sql =====

-- ===== START: 021_privilege_escalation_hardening.sql =====
-- ============================================================
-- 021 — Privilege Escalation Hardening (Security S1+S2+S3)
-- ============================================================
-- Audit 2026-07-09 bulguları:
--
-- S1 (Critical): profiles UPDATE policy'sinde `WITH CHECK` yoktu,
--   herhangi kullanıcı browser console'dan
--   `supabase.from("profiles").update({role: "super_admin"})` atıp
--   sistem yöneticisi olabiliyordu.
--
-- S2 (Critical): handle_new_user trigger'ı signup'ta
--   raw_user_meta_data->>'role' okuyordu. raw_user_meta_data
--   tamamen client-kontrollüdür (supabase.auth.signUp options.data).
--   Attacker signup'ta {role: "super_admin"} gönderirse trigger'a
--   inanıp direkt super_admin kaydediyordu.
--
-- S3 (Critical): 011 migration'daki "Company admin can manage
--   invitations" policy'si, 009'daki role kontrolünü DÜŞÜRMÜŞTÜ.
--   Herhangi bir employee kendi email'iyle role='company_admin'
--   invitation INSERT edip, sonra /api/invitations/accept çağırıp
--   company_admin'e yükselebiliyordu.
--
-- Fix stratejisi:
--   1. profiles UPDATE'te trigger — role/company_id/plan/is_active/
--      deleted_at/deleted_by/must_change_password kolonları sadece
--      service_role tarafından değiştirilebilir. Kullanıcı kendi
--      full_name/email/bundesland/hourly_rate vs güncelleyebilir.
--   2. handle_new_user — role/company_id metadata'dan okumaz,
--      her yeni kullanıcı 'individual' + null company başlar.
--      Company invitation'ları /api/invitations/accept'te
--      (service_role ile) uygulanır.
--   3. invitations "manage" policy — role predicate geri konur
--      (sadece company_admin/super_admin invitation yaratabilir).
--
-- Rollback:
--   drop trigger profiles_enforce_privileges on public.profiles;
--   drop function public.enforce_profile_privileges();
--   -- handle_new_user'ı geri almak için 011:342-370 blogunu apply et
--   -- invitations policy'sini eski (unrestricted) haline geri almak
--   -- için 011:158-174 apply et — AMA S3 açığı yeniden açılır.
-- ============================================================

-- ============================================================
-- 1. profiles: privileged column lock down (S1)
-- ============================================================
create or replace function public.enforce_profile_privileges()
returns trigger language plpgsql security definer as $$
begin
  -- service_role tüm değişikliklere izinli
  if auth.role() = 'service_role' then
    return new;
  end if;

  -- Aşağıdaki kolonları sadece server route (service_role) değiştirebilir
  if new.role is distinct from old.role then
    raise exception 'permission denied: role can only be changed by service role';
  end if;

  if new.company_id is distinct from old.company_id then
    raise exception 'permission denied: company_id can only be changed by service role';
  end if;

  if new.plan is distinct from old.plan then
    raise exception 'permission denied: plan can only be changed by service role';
  end if;

  if new.is_active is distinct from old.is_active then
    raise exception 'permission denied: is_active can only be changed by service role';
  end if;

  if new.deleted_at is distinct from old.deleted_at then
    raise exception 'permission denied: deleted_at can only be changed by service role';
  end if;

  if new.deleted_by is distinct from old.deleted_by then
    raise exception 'permission denied: deleted_by can only be changed by service role';
  end if;

  if new.must_change_password is distinct from old.must_change_password then
    raise exception 'permission denied: must_change_password can only be changed by service role';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_enforce_privileges on public.profiles;
create trigger profiles_enforce_privileges
  before update on public.profiles
  for each row execute function public.enforce_profile_privileges();

-- ============================================================
-- 2. handle_new_user — metadata'ya güvenme (S2)
-- ============================================================
-- KRİTİK KURAL: raw_user_meta_data client tarafından set edilir
-- (options.data via supabase.auth.signUp). ASLA güvenilmez.
-- Yeni user her zaman 'individual' + null company_id başlar.
-- Invitation-based yükseltmeler /api/invitations/accept'te
-- (server-side, service_role) yapılır.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, email, role, plan)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    'individual',
    'trial'
  )
  on conflict (user_id) do update set
    full_name = excluded.full_name,
    email     = excluded.email;
    -- NOT: role/plan/company_id burada güncellenmez.
    -- Var olan bir profil varsa (edge case: re-signup) ayrıcalıklarını
    -- korur. Yeni kullanıcı ise INSERT path ile 'individual' başlar.
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 3. invitations "manage" policy — role predicate geri (S3)
-- ============================================================
drop policy if exists "Company admin can manage invitations" on public.invitations;

create policy "Company admin can manage invitations"
  on public.invitations for all
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.company_id = invitations.company_id
        and p.role in ('company_admin', 'super_admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.company_id = invitations.company_id
        and p.role in ('company_admin', 'super_admin')
    )
  );

-- ============================================================
-- 4. Backfill audit — sistemde beklenmeyen super_admin var mı?
-- ============================================================
-- Bilgi amaçlı log — application-level'da manual kontrol edilir.
-- Migration'ı bloklamaz.
do $$
declare
  suspicious_count int;
begin
  select count(*) into suspicious_count
  from public.profiles
  where role = 'super_admin';

  if suspicious_count > 1 then
    raise notice 'AUDIT: % super_admin kullanıcı var. Manual verify et.', suspicious_count;
  end if;
end $$;
-- ===== END: 021_privilege_escalation_hardening.sql =====

-- ===== START: 022_salary_sfn_enabled.sql =====
-- ============================================================
-- 022_salary_sfn_enabled.sql
-- salary_settings.sfn_enabled — §3b EStG SFN-Zuschläge toggle
-- Default false: bestehende Nutzer sehen keine Änderung.
-- Idempotent — defalarca çalıştırılabilir
-- ============================================================

alter table public.salary_settings
  add column if not exists sfn_enabled boolean default false;

comment on column public.salary_settings.sfn_enabled is
  'Wenn true: §3b EStG SFN-Zuschläge (Sonntag/Feiertag/Nacht) automatisch aus Zeitstempeln berechnet, Steuer- und SV-Basis entsprechend reduziert.';

select 'Migration 022 başarıyla tamamlandı: sfn_enabled eklendi.' as result;
-- ===== END: 022_salary_sfn_enabled.sql =====

-- ===== START: 023_salary_burlg_fields.sql =====
-- ============================================================
-- 023_salary_burlg_fields.sql
-- L6/L7 §5+§7 BUrlG — Beschäftigungszeitraum + Urlaubs-Übertrag
--
-- Yeni alanlar:
--   • salary_settings.employment_start_date — Beschäftigungsbeginn (§5 Zwölftelung)
--   • salary_settings.employment_end_date   — Beschäftigungsende (letzter Tag)
--   • salary_settings.urlaub_carry_over     — Übertrag Vorjahr (Tage, §7 III)
--
-- Alle nullable / default 0. Bestehende Nutzer sehen keine Änderung.
-- Idempotent — defalarca çalıştırılabilir.
-- ============================================================

alter table public.salary_settings
  add column if not exists employment_start_date date,
  add column if not exists employment_end_date   date,
  add column if not exists urlaub_carry_over     numeric(5,2) default 0
    check (urlaub_carry_over >= 0 and urlaub_carry_over <= 60);

comment on column public.salary_settings.employment_start_date is
  'Beschäftigungsbeginn — §5 BUrlG Zwölftelung des Urlaubsanspruchs bei unterjähriger Beschäftigung.';
comment on column public.salary_settings.employment_end_date is
  'Beschäftigungsende (letzter Arbeitstag) — §5 BUrlG. NULL = weiterhin aktiv.';
comment on column public.salary_settings.urlaub_carry_over is
  'Übertrag Urlaubstage aus Vorjahr — §7 III BUrlG. Muss bis 31.03 des laufenden Jahres genommen werden, sonst Verfall.';

select 'Migration 023 başarıyla tamamlandı: BUrlG alanları eklendi.' as result;
-- ===== END: 023_salary_burlg_fields.sql =====

-- ===== START: 024_rate_limit_events.sql =====
-- ============================================================
-- 024_rate_limit_events.sql
-- Persistent rate limiting store — replaces in-memory Map
-- (Audit R4+R5: In-memory Vercel serverless instance başına, çakışma var)
--
-- Kullanım: check.ts helper bir bucket için (örn. "scan:userId")
-- son N saniyedeki event sayısını sayar. Limit aşılırsa 429.
--
-- Cleanup: /api/cron/rate-limit-cleanup günlük eski rows'u siler.
-- Idempotent — defalarca çalıştırılabilir.
-- ============================================================

create table if not exists public.rate_limit_events (
  id         bigserial   primary key,
  bucket     text        not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rlm_bucket_created
  on public.rate_limit_events (bucket, created_at desc);

-- Alt-index cleanup için (created_at eski ise sil)
create index if not exists idx_rlm_created
  on public.rate_limit_events (created_at);

alter table public.rate_limit_events enable row level security;
-- Sadece service_role okur/yazar. Public policy yok — RLS default deny.

comment on table public.rate_limit_events is
  'Sliding-window rate limiter — service_role tarafından yazılır, cron ile temizlenir.';
comment on column public.rate_limit_events.bucket is
  'Rate limit key: örn. "scan:<user_id>" veya "contact:<ip>".';

select 'Migration 024 başarıyla tamamlandı: rate_limit_events tablosu oluşturuldu.' as result;
-- ===== END: 024_rate_limit_events.sql =====

-- ===== START: 025_profiles_weekly_digest.sql =====
-- ============================================================
-- 025_profiles_weekly_digest.sql
-- Weekly digest email opt-in (retention feature).
-- Default false — mevcut kullanıcılara sürpriz mail atılmasın.
-- Settings sayfasında toggle.
-- Idempotent — defalarca çalıştırılabilir.
-- ============================================================

alter table public.profiles
  add column if not exists weekly_digest_enabled boolean default false;

comment on column public.profiles.weekly_digest_enabled is
  'Weekly digest email opt-in — Pazartesi 06:00 UTC otomatik ozet mail. Default false.';

-- Cron endpoint hizli sorgu için index (partial: sadece opt-in olanlar)
create index if not exists idx_profiles_weekly_digest_enabled
  on public.profiles (weekly_digest_enabled)
  where weekly_digest_enabled = true;

select 'Migration 025 başarıyla tamamlandı: weekly_digest_enabled eklendi.' as result;
-- ===== END: 025_profiles_weekly_digest.sql =====

-- ===== START: 026_profiles_monthly_report.sql =====
-- ============================================================
-- 026_profiles_monthly_report.sql
-- Monthly report email opt-in (retention feature #2).
-- Default false. Settings toggle.
-- Idempotent — defalarca çalıştırılabilir.
-- ============================================================

alter table public.profiles
  add column if not exists monthly_report_enabled boolean default false;

comment on column public.profiles.monthly_report_enabled is
  'Monthly report email opt-in — her ayin 1''inde onceki ayin ozeti + /reports linki. Default false.';

create index if not exists idx_profiles_monthly_report_enabled
  on public.profiles (monthly_report_enabled)
  where monthly_report_enabled = true;

select 'Migration 026 başarıyla tamamlandı: monthly_report_enabled eklendi.' as result;
-- ===== END: 026_profiles_monthly_report.sql =====

-- ===== START: 027_performance_indexes.sql =====
-- ============================================================
-- 027_performance_indexes.sql
-- Query pattern'ına göre 4 hedefe yönelik index.
--
-- Not: audit "0 CREATE INDEX" iddia etmişti ama 26 migration'da 13
-- index zaten var. Bu migration gerçek gap'ları kapatır.
--
-- Idempotent (CREATE INDEX IF NOT EXISTS). Concurrently değil — küçük
-- ölçekli beta DB, kısa lock kabul edilebilir. Prod'da CONCURRENTLY
-- gerekirse ayrı bir migration.
-- ============================================================

-- 1. time_entries.tags GIN — sample data DELETE için KRİTİK
--    (contains("tags", ["sample"]) sorgusu full-table scan yapıyordu)
create index if not exists idx_time_entries_tags_gin
  on public.time_entries using gin (tags);

-- 2. vacation_requests (user_id, status) — pending Urlaub filter
--    (company dashboard + vacation page + weekly digest)
create index if not exists idx_vacation_requests_user_status
  on public.vacation_requests (user_id, status);

-- 3. salary_settings (user_id, created_at DESC) — "en son settings"
--    (dashboard, salary, reports/data endpoint — hepsi bu pattern'ı kullanıyor)
create index if not exists idx_salary_settings_user_created
  on public.salary_settings (user_id, created_at desc);

-- 4. time_entries (user_id, day_type, date) — day_type filter
--    (Urlaub/Krank/Arbeiten sayacı — MonthlySummary, dashboard, reports)
--    Mevcut (user_id, date) tek başına yeterli değil çünkü day_type
--    ayrı kolon üzerinde filter var, index-only scan mümkün olmuyor
create index if not exists idx_time_entries_user_daytype_date
  on public.time_entries (user_id, day_type, date);

comment on index public.idx_time_entries_tags_gin is
  'GIN index for tags array — sample data cleanup + tag search.';
comment on index public.idx_vacation_requests_user_status is
  'Pending Urlaub filter (company dashboard, vacation, weekly digest).';
comment on index public.idx_salary_settings_user_created is
  'Latest salary_settings per user (dashboard/salary/reports).';
comment on index public.idx_time_entries_user_daytype_date is
  'day_type filter (Urlaub/Krank/Arbeiten sayacı — all pages).';

select 'Migration 027 başarıyla tamamlandı: 4 performance index eklendi.' as result;
-- ===== END: 027_performance_indexes.sql =====

-- ===== START: 028_custom_access_token_hook.sql =====
-- ============================================================
-- 028_custom_access_token_hook.sql
-- JWT claim: user_role — role'u profiles tablosundan JWT'ye göm.
--
-- Motivasyon:
-- Middleware her /company, /team, /superadmin request'inde
-- profiles.role için ekstra DB read yapıyordu. Bu hook role'u JWT
-- claim'ine gömer, middleware base64 decode ile okur — DB read yok.
--
-- Nasıl calisir:
-- Supabase Auth, her access token mint ettiğinde (signIn / refresh /
-- auto-refresh) bu function'ı çağırır. Function `claims` JSON'una
-- `user_role` ekleyip döner. Sonraki request'lerde JWT payload'ında
-- claim mevcut olur.
--
-- ONEMLI DEPLOY ADIMI:
-- Bu function tanımlandıktan SONRA Supabase Dashboard'da
--   Authentication → Hooks → "Custom Access Token"
-- olarak enable edilmeli ve public.custom_access_token_hook seçilmeli.
-- Enable edilmezse function tanımlıdır ama çağrılmaz — middleware
-- fallback DB read'e düşer, davranış eskisi gibi kalır (regression yok).
--
-- Rollback:
-- Dashboard'dan hook disable et; function drop et:
--   drop function public.custom_access_token_hook(jsonb);
-- Middleware zaten fallback ile geriye uyumlu.
-- ============================================================

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  claims jsonb;
  user_role_val text;
begin
  claims := event->'claims';

  select role
    into user_role_val
    from public.profiles
   where user_id = (event->>'user_id')::uuid;

  -- Profile yoksa (edge case: user auth.users'da var ama profiles'ta yok)
  -- veya role null ise default 'individual'
  claims := jsonb_set(
    claims,
    '{user_role}',
    to_jsonb(coalesce(user_role_val, 'individual'))
  );

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- Auth service function'ı çağırabilsin
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

-- Function security definer olduğu için profiles'i owner (postgres) yetkisiyle
-- okur — supabase_auth_admin'e ekstra SELECT gerekmez.
-- ===== END: 028_custom_access_token_hook.sql =====

-- ===== START: 029_notdienst_anhaenge.sql =====
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
-- ===== END: 029_notdienst_anhaenge.sql =====

-- ===== START: 030_notdienst_kunde_telefon.sql =====
-- ============================================================
-- 030_notdienst_kunde_telefon.sql
-- Telefonnummer des Kunden am Notdienst-Einsatz (v0.63.0).
-- Idempotent — kann gefahrlos mehrfach ausgefuehrt werden.
-- RLS der Tabelle gilt unveraendert (eigene Zeilen / Firmen-Admin lesen).
-- ============================================================

alter table public.notdienst_entries
  add column if not exists kunde_telefon text;
-- ===== END: 030_notdienst_kunde_telefon.sql =====

-- ===== START: 031_reminder_emails.sql =====
-- 031_reminder_emails.sql
-- Erinnerungs-Mails für Nutzer, die Stundly nach der Registrierung nicht (mehr) nutzen.
-- Cron /api/cron/reminders (täglich). Default: an — abbestellbar per Link in jeder Mail
-- und in den Einstellungen.

alter table public.profiles
  add column if not exists reminder_emails_enabled boolean default true,
  add column if not exists reminder_last_type      text,
  add column if not exists reminder_last_sent_at   timestamptz;

comment on column public.profiles.reminder_emails_enabled is
  'Erinnerungs-Mails (start / start2 / comeback). Default true, abbestellbar.';
comment on column public.profiles.reminder_last_type is
  'Zuletzt gesendete Erinnerung: start | start2 | comeback';
comment on column public.profiles.reminder_last_sent_at is
  'Zeitpunkt der letzten Erinnerungs-Mail';

select 'Migration 031 erfolgreich: reminder_emails_enabled, reminder_last_type, reminder_last_sent_at' as result;
-- ===== END: 031_reminder_emails.sql =====

-- ===== START: 032_superadmin_user_activity.sql =====
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
-- ===== END: 032_superadmin_user_activity.sql =====

-- ===== START: 033_company_workflow.sql =====
-- 033_company_workflow.sql
-- Firmen-Workflow: Vertragsdaten, Monatsabschluss, Korrekturen mit Begründung, Schutzregeln.
--
-- Prinzip: Mitarbeiter erfassen selbst, die Firma sieht alles, bestätigt Monate und darf
-- korrigieren — aber nie heimlich (jede Korrektur mit Begründung, für den Mitarbeiter sichtbar).
-- Alle schreibenden Firmen-Aktionen laufen über Server-Routen (service_role).

-- ============================================================
-- 1. Vertragsdaten — vom Arbeitgeber gepflegt (profiles)
-- ============================================================
alter table public.profiles
  add column if not exists contract_weekly_hours  numeric(5,2),
  add column if not exists contract_vacation_days numeric(4,1),
  add column if not exists contract_start         date;

comment on column public.profiles.contract_weekly_hours  is 'Vertragliche Wochenstunden (von der Firma gesetzt; null = Mitarbeiter pflegt selbst)';
comment on column public.profiles.contract_vacation_days is 'Jährlicher Urlaubsanspruch laut Vertrag (von der Firma gesetzt)';
comment on column public.profiles.contract_start         is 'Beschäftigungsbeginn (von der Firma gesetzt)';

-- Nur service_role darf Vertragsdaten ändern (Erweiterung von 021 enforce_profile_privileges)
create or replace function public.enforce_profile_contract()
returns trigger language plpgsql security definer as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if new.contract_weekly_hours  is distinct from old.contract_weekly_hours
  or new.contract_vacation_days is distinct from old.contract_vacation_days
  or new.contract_start         is distinct from old.contract_start then
    raise exception 'permission denied: Vertragsdaten legt die Firma fest';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_enforce_contract on public.profiles;
create trigger profiles_enforce_contract
  before update on public.profiles
  for each row execute function public.enforce_profile_contract();

-- salary_settings: Soll-Stunden + Urlaubsanspruch folgen dem Vertrag, wenn die Firma ihn gesetzt hat
create or replace function public.salary_settings_follow_contract()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  wk numeric; vac numeric;
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  select contract_weekly_hours, contract_vacation_days into wk, vac
    from public.profiles where user_id = new.user_id;
  if wk is not null then
    new.monthly_target_hours := round(wk * 52 / 12, 2);
  end if;
  if vac is not null then
    new.urlaub_anspruch := vac;
  end if;
  return new;
end;
$$;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'salary_settings' and column_name = 'urlaub_anspruch') then
    execute 'drop trigger if exists salary_settings_follow_contract on public.salary_settings';
    execute 'create trigger salary_settings_follow_contract before insert or update on public.salary_settings
             for each row execute function public.salary_settings_follow_contract()';
  end if;
end $$;

-- ============================================================
-- 2. Monatsabschluss
-- ============================================================
create table if not exists public.month_closings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  company_id    uuid references public.companies(id) on delete cascade,
  year          int  not null,
  month         int  not null check (month between 1 and 12),
  status        text not null check (status in ('submitted', 'approved')),
  submitted_at  timestamptz,
  approved_at   timestamptz,
  approved_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (user_id, year, month)
);

create index if not exists month_closings_company_idx on public.month_closings (company_id, year, month);

alter table public.month_closings enable row level security;

drop policy if exists "Own month closings readable" on public.month_closings;
create policy "Own month closings readable"
  on public.month_closings for select using (auth.uid() = user_id);

drop policy if exists "Company admin can view team month closings" on public.month_closings;
create policy "Company admin can view team month closings"
  on public.month_closings for select using (public.is_company_member_of_admin(user_id));
-- Schreiben nur über Server-Routen (service_role) — keine insert/update-Policies.

-- ============================================================
-- 3. Korrekturen durch die Firma
-- ============================================================
create table if not exists public.entry_corrections (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  company_id    uuid references public.companies(id) on delete cascade,
  entity        text not null check (entity in ('time_entry', 'notdienst')),
  entry_date    date not null,
  before        jsonb,
  after         jsonb,
  reason        text not null check (length(trim(reason)) >= 3),
  corrected_by  uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  seen_at       timestamptz
);

create index if not exists entry_corrections_user_idx on public.entry_corrections (user_id, created_at desc);

alter table public.entry_corrections enable row level security;

drop policy if exists "Own corrections readable" on public.entry_corrections;
create policy "Own corrections readable"
  on public.entry_corrections for select using (auth.uid() = user_id);

drop policy if exists "Company admin can view team corrections" on public.entry_corrections;
create policy "Company admin can view team corrections"
  on public.entry_corrections for select using (public.is_company_member_of_admin(user_id));

-- ============================================================
-- 4. Schutz: bestätigte Monate sind gesperrt
-- ============================================================
-- Notdienst zählt zum Monat des Wochen-Sonntags (wie lib/utils/weekMonth.notdienstMonthOf)
create or replace function public.notdienst_month_date(d date)
returns date language sql immutable as $$
  select d + ((7 - extract(isodow from d)::int) % 7);
$$;

create or replace function public.month_is_approved(uid uuid, d date)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.month_closings mc
    where mc.user_id = uid and mc.status = 'approved'
      and mc.year = extract(year from d)::int and mc.month = extract(month from d)::int
  );
$$;

create or replace function public.guard_locked_month()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_nd boolean := tg_table_name = 'notdienst_entries';
  d_old date; d_new date;
begin
  if auth.role() = 'service_role' then
    return coalesce(new, old);
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    d_old := case when is_nd then public.notdienst_month_date(old.date) else old.date end;
    if public.month_is_approved(old.user_id, d_old) then
      raise exception 'Monat ist abgeschlossen — Änderungen nur durch die Firma';
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    d_new := case when is_nd then public.notdienst_month_date(new.date) else new.date end;
    if public.month_is_approved(new.user_id, d_new) then
      raise exception 'Monat ist abgeschlossen — Änderungen nur durch die Firma';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists time_entries_guard_locked_month on public.time_entries;
create trigger time_entries_guard_locked_month
  before insert or update or delete on public.time_entries
  for each row execute function public.guard_locked_month();

drop trigger if exists notdienst_guard_locked_month on public.notdienst_entries;
create trigger notdienst_guard_locked_month
  before insert or update or delete on public.notdienst_entries
  for each row execute function public.guard_locked_month();

-- ============================================================
-- 5. Schutz: Notdienst "bezahlt" setzt bei Firmen-Mitarbeitern die Firma
-- ============================================================
create or replace function public.guard_notdienst_paid()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if new.erledigt is distinct from old.erledigt and exists (
    select 1 from public.profiles p
    where p.user_id = new.user_id and p.company_id is not null and p.role = 'employee'
  ) then
    raise exception 'Den Bezahlt-Status setzt deine Firma';
  end if;
  return new;
end;
$$;

drop trigger if exists notdienst_guard_paid on public.notdienst_entries;
create trigger notdienst_guard_paid
  before update on public.notdienst_entries
  for each row execute function public.guard_notdienst_paid();

select 'Migration 033 erfolgreich: Vertragsdaten, month_closings, entry_corrections, Monatssperre, Bezahlt-Schutz' as result;
-- ===== END: 033_company_workflow.sql =====

-- ===== START: 034_notdienst_zentrale.sql =====
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
-- ===== END: 034_notdienst_zentrale.sql =====

-- ===== START: 035_lohn_steuerberater.sql =====
-- 035_lohn_steuerberater.sql
-- Firmen-Panel Phase D: Lohn-Vorbereitung an den Steuerberater + Montags-Ueberblick fuer den Chef.
-- Idempotent. Geschrieben nur ueber Server-Routen (service_role).

alter table public.companies
  add column if not exists steuerberater_email     text
    check (steuerberater_email is null or steuerberater_email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'),
  add column if not exists steuerberater_auto      boolean not null default false,
  add column if not exists steuerberater_last_sent text,
  add column if not exists team_digest_enabled     boolean not null default false;

comment on column public.companies.steuerberater_email     is 'E-Mail des Steuerberaters / Lohnbueros fuer die monatliche Lohn-Vorbereitung.';
comment on column public.companies.steuerberater_auto      is 'true = Lohn-Vorbereitung des Vormonats automatisch am 5. versenden.';
comment on column public.companies.steuerberater_last_sent is 'Zuletzt automatisch versendeter Monat (YYYY-MM) — verhindert Doppelversand.';
comment on column public.companies.team_digest_enabled     is 'true = Chef bekommt montags einen Team-Ueberblick per E-Mail.';

select 'Migration 035 erfolgreich: Steuerberater + Montags-Ueberblick' as result;
-- ===== END: 035_lohn_steuerberater.sql =====

-- ===== START: 036_firma_briefkopf.sql =====
-- 036_firma_briefkopf.sql
-- Briefkopf (Logo, Adresse, Telefon) pflegt der Chef im Firmen-Panel.
-- Mitarbeiter sehen ihn in ihren PDFs, koennen ihn aber nicht aendern.
-- Idempotent. Geschrieben nur ueber Server-Routen (service_role).

alter table public.companies
  add column if not exists phone     text check (phone is null or char_length(phone) <= 40),
  add column if not exists logo_data text check (logo_data is null or char_length(logo_data) <= 600000);

comment on column public.companies.phone     is 'Telefon im Briefkopf der PDFs.';
comment on column public.companies.logo_data is 'Firmenlogo als data:-URL (verkleinert), Briefkopf der PDFs.';

-- Nur die Briefkopf-Felder der eigenen Firma (nicht Steuerberater usw.)
create or replace function public.my_company_briefkopf()
returns table (name text, address_line1 text, postal_code text, city text, phone text, logo_data text)
language sql
stable
security definer
set search_path = public
as $$
  select c.name, c.address_line1, c.postal_code, c.city, c.phone, c.logo_data
  from public.companies c
  join public.profiles p on p.company_id = c.id
  where p.user_id = auth.uid()
    and p.deleted_at is null
  limit 1
$$;

revoke all on function public.my_company_briefkopf() from public;
grant execute on function public.my_company_briefkopf() to authenticated;

select 'Migration 036 erfolgreich: Firmen-Briefkopf' as result;
-- ===== END: 036_firma_briefkopf.sql =====

-- ===== START: 037_error_events.sql =====
-- ============================================================
-- 037_error_events.sql
-- Eigene Fehlerüberwachung (ohne externen Dienst):
--   Browser-Fehler  → POST /api/errors        (source = 'client')
--   Server-Fehler   → instrumentation.ts       (source = 'server')
-- Süper admin görür: /superadmin/errors · günlük mail: /api/cron/error-digest
-- Kayıtlar 30 gün sonra cron tarafından silinir.
-- Idempotent — defalarca çalıştırılabilir.
-- ============================================================

create table if not exists public.error_events (
  id          bigserial   primary key,
  created_at  timestamptz not null default now(),
  source      text        not null check (source in ('client', 'server')),
  fingerprint text        not null,
  message     text        not null,
  stack       text,
  location    text,
  path        text,
  digest      text,
  user_id     uuid,
  user_agent  text,
  app_version text
);

create index if not exists idx_error_events_created
  on public.error_events (created_at desc);

create index if not exists idx_error_events_fp_created
  on public.error_events (fingerprint, created_at desc);

alter table public.error_events enable row level security;
-- Sadece service_role okur/yazar. Public policy yok — RLS default deny.

comment on table public.error_events is
  'Fehlerereignisse (Browser + Server) — service_role schreibt, Cron löscht nach 30 Tagen.';

select 'Migration 037 başarıyla tamamlandı: error_events tablosu oluşturuldu.' as result;
-- ===== END: 037_error_events.sql =====
