-- ============================================================
-- 009_saas_companies.sql
-- SaaS Multi-Tenant: Şirket & Abonelik Sistemi (AB/Almanya Uyumlu)
-- ============================================================

-- Plan türleri
create type subscription_plan as enum ('trial', 'individual', 'team', 'business');

-- Abonelik durumu
create type subscription_status as enum ('active', 'trialing', 'past_due', 'canceled', 'incomplete');

-- Kullanıcı rolü (global)
create type user_role as enum ('super_admin', 'company_admin', 'employee', 'individual');

-- Davet durumu
create type invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');

-- ============================================================
-- COMPANIES — Şirket / müşteri kaydı
-- ============================================================
create table public.companies (
  id                    uuid primary key default uuid_generate_v4(),
  name                  text not null,
  slug                  text unique,                      -- workly.app/company/slug
  logo_url              text,
  country_code          text not null default 'DE',       -- ISO 3166-1 alpha-2
  bundesland            text not null default 'BE',       -- Almanya eyalet kodu (Feiertage için)
  vat_id                text,                             -- USt-IdNr. (DE123456789)
  address_line1         text,
  address_line2         text,
  postal_code           text,
  city                  text,
  owner_id              uuid references auth.users(id) on delete set null,
  max_employees         integer not null default 10,      -- plana göre limit
  created_at            timestamptz default now() not null,
  updated_at            timestamptz default now() not null
);

create index companies_owner_idx on public.companies (owner_id);

alter table public.companies enable row level security;

-- Şirket admini kendi şirketini görebilir
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

-- Şirket admini kendi şirketini güncelleyebilir
create policy "Company admin can update own company"
  on public.companies for update
  using (owner_id = auth.uid());

-- Yeni şirket oluşturma (kayıt akışında)
create policy "Authenticated users can create company"
  on public.companies for insert
  with check (auth.uid() = owner_id);

-- ============================================================
-- SUBSCRIPTIONS — Stripe abonelik takibi
-- ============================================================
create table public.subscriptions (
  id                      uuid primary key default uuid_generate_v4(),
  company_id              uuid references public.companies(id) on delete cascade,
  user_id                 uuid references auth.users(id) on delete cascade, -- individual plan için
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

  -- Ya company_id ya user_id olmalı
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
-- INVITATIONS — Çalışan davet sistemi
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

-- Company admin kendi davetlerini görebilir/yönetebilir
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

-- Token ile davet doğrulama (public — kayıtsız kullanıcı davet linkini açabilmeli)
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

-- company_id foreign key (önceki migration'da text'ti, uuid'ye bağlayalım)
-- Mevcut company_id kolonunu kontrol et
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'profiles_company_id_fkey'
  ) then
    -- Önce mevcut veriyi temizle (geliştirme ortamı)
    alter table public.profiles
      add constraint profiles_company_id_fkey
      foreign key (company_id) references public.companies(id) on delete set null;
  end if;
end $$;

-- Super admin tüm profilleri görebilir
create policy "Super admin can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role = 'super_admin'
    )
  );

-- Company admin kendi şirketinin profillerini görebilir
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
-- AUDIT LOG — DSGVO gereği veri işleme kaydı
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

-- Kullanıcı kendi audit logunu görebilir
create policy "Users can view own audit logs"
  on public.audit_logs for select
  using (user_id = auth.uid());

-- Sadece service role yazabilir
create policy "Service role can insert audit logs"
  on public.audit_logs for insert
  with check (auth.role() = 'service_role');

-- ============================================================
-- GDPR DATA DELETION REQUESTS — DSGVO silme talepleri
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
-- UPDATED_AT TRIGGER — companies & subscriptions için
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
-- handle_new_user trigger güncellemesi
-- Kayıt sırasında role ve plan set edilsin
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
