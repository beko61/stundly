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
