-- ============================================================
-- 010_saas_plans_and_limits.sql
-- Plan limitleri & özellik kontrolü
-- ============================================================

-- Plan konfigürasyonu tablosu
create table public.plan_features (
  plan                  subscription_plan primary key,
  display_name_de       text not null,           -- Almanca plan adı
  display_name_en       text not null,
  price_monthly_eur     numeric(8,2) not null,   -- EUR, MwSt hariç (netto)
  price_yearly_eur      numeric(8,2) not null,
  max_employees         integer,                  -- null = sınırsız
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

-- RLS: herkes okuyabilir (pricing sayfası için)
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

-- Varsayılan planlar (EUR, MwSt hariç)
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
-- Plan limit kontrolü — çalışan eklenebilir mi?
-- ============================================================
create or replace function public.check_employee_limit(p_company_id uuid)
returns boolean language plpgsql security definer as $$
declare
  v_max_employees integer;
  v_current_count integer;
  v_plan          subscription_plan;
begin
  -- Şirketin aktif planını al
  select s.plan into v_plan
  from public.subscriptions s
  where s.company_id = p_company_id
    and s.status in ('active', 'trialing')
  order by s.created_at desc
  limit 1;

  if v_plan is null then
    v_plan := 'trial';
  end if;

  -- Planın max çalışan limitini al
  select pf.max_employees into v_max_employees
  from public.plan_features pf
  where pf.plan = v_plan;

  -- null = sınırsız
  if v_max_employees is null then
    return true;
  end if;

  -- Mevcut çalışan sayısı
  select count(*) into v_current_count
  from public.profiles p
  where p.company_id = p_company_id
    and p.is_active = true;

  return v_current_count < v_max_employees;
end;
$$;

-- ============================================================
-- Stripe webhook log (debug & DSGVO kayıt için)
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

-- Sadece service role erişebilir
create policy "Service role only"
  on public.stripe_webhook_events for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
