-- Lensello Business Profile & LENS Framework enhancements
-- Adds onboarding status, LENS scoring, and business goals

set lock_timeout = '10s';

-- Add onboarding status to profiles
alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists onboarding_step text check (onboarding_step is null or onboarding_step in ('categories','location','pricing','goals','connect','complete'));

-- Extend existing business_profile table with LENS framework columns
alter table public.business_profile
  add column if not exists photography_categories text[] default '{}',
  add column if not exists location_country text,
  add column if not exists location_region text,
  add column if not exists geographic_service_area text,
  add column if not exists average_booking_value_cents integer check (average_booking_value_cents is null or average_booking_value_cents > 0),
  add column if not exists desired_monthly_bookings integer check (desired_monthly_bookings is null or desired_monthly_bookings > 0),
  add column if not exists annual_revenue_target_cents integer check (annual_revenue_target_cents is null or annual_revenue_target_cents > 0),
  add column if not exists current_booking_rate integer check (current_booking_rate is null or current_booking_rate >= 0),
  add column if not exists known_quiet_periods text[] default '{}',
  add column if not exists ideal_client_description text,
  add column if not exists desired_work_types text,
  add column if not exists website_url text,
  -- Integrations
  add column if not exists meta_account_linked boolean default false,
  add column if not exists google_business_linked boolean default false,
  add column if not exists google_analytics_linked boolean default false,
  add column if not exists email_crm_linked boolean default false,
  -- LENS baseline scores
  add column if not exists lead_monthly_enquiries integer check (lead_monthly_enquiries is null or lead_monthly_enquiries >= 0),
  add column if not exists lead_sources text[] default '{}',
  add column if not exists lead_organic_pct integer check (lead_organic_pct is null or (lead_organic_pct >= 0 and lead_organic_pct <= 100)),
  add column if not exists lead_paid_pct integer check (lead_paid_pct is null or (lead_paid_pct >= 0 and lead_paid_pct <= 100)),
  add column if not exists lead_referral_pct integer check (lead_referral_pct is null or (lead_referral_pct >= 0 and lead_referral_pct <= 100)),
  add column if not exists elevate_google_rating numeric(2,1) check (elevate_google_rating is null or (elevate_google_rating >= 1 and elevate_google_rating <= 5)),
  add column if not exists elevate_review_count integer check (elevate_review_count is null or elevate_review_count >= 0),
  add column if not exists elevate_portfolio_shoot_count integer check (elevate_portfolio_shoot_count is null or elevate_portfolio_shoot_count >= 0),
  add column if not exists elevate_positioning_clarity text,
  add column if not exists nurture_response_time_hours integer check (nurture_response_time_hours is null or nurture_response_time_hours > 0),
  add column if not exists nurture_conversion_pct integer check (nurture_conversion_pct is null or (nurture_conversion_pct >= 0 and nurture_conversion_pct <= 100)),
  add column if not exists nurture_consultation_rate_pct integer check (nurture_consultation_rate_pct is null or (nurture_consultation_rate_pct >= 0 and nurture_consultation_rate_pct <= 100)),
  add column if not exists nurture_followup_system text,
  add column if not exists scale_average_booking_value_cents integer check (scale_average_booking_value_cents is null or scale_average_booking_value_cents > 0),
  add column if not exists scale_profit_margin_pct integer check (scale_profit_margin_pct is null or (scale_profit_margin_pct >= 0 and scale_profit_margin_pct <= 100)),
  add column if not exists scale_monthly_capacity_bookings integer check (scale_monthly_capacity_bookings is null or scale_monthly_capacity_bookings > 0),
  add column if not exists scale_automation_level text check (scale_automation_level is null or scale_automation_level in ('minimal','partial','advanced'));

-- Business goals: what the photographer wants more of
create table if not exists public.business_goals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  photography_type text not null check (length(trim(photography_type)) > 0),
  priority text not null check (priority in (
    'more_enquiries',
    'higher_value',
    'destination_work',
    'fill_dates',
    'build_next_year',
    'increase_average_sale',
    'reconnect_old_enquiries',
    'venue_specific',
    'seasonal_boost',
    'past_client_sales'
  )),
  target_monthly_bookings integer check (target_monthly_bookings is null or target_monthly_bookings > 0),
  target_monthly_revenue_cents integer check (target_monthly_revenue_cents is null or target_monthly_revenue_cents > 0),
  is_active boolean not null default true,
  status text not null default 'planning' check (status in ('planning','active','paused','completed'))
);

comment on table public.business_goals is
  'Commercial objectives tied to photography types. Guides campaign creation and prioritization.';

create trigger business_goals_touch before update on public.business_goals
  for each row execute function public.touch_updated_at();

-- Enable RLS on business_goals
alter table public.business_goals enable row level security;

-- RLS Policies for business_goals
drop policy if exists "staff_read_business_goals" on public.business_goals;
drop policy if exists "staff_write_business_goals" on public.business_goals;
drop policy if exists "staff_insert_business_goals" on public.business_goals;
drop policy if exists "staff_delete_business_goals" on public.business_goals;

create policy "staff_read_business_goals" on public.business_goals
  for select using (public.is_staff());

create policy "staff_write_business_goals" on public.business_goals
  for update using (public.is_staff());

create policy "staff_insert_business_goals" on public.business_goals
  for insert with check (public.is_staff());

create policy "staff_delete_business_goals" on public.business_goals
  for delete using (public.is_staff());
