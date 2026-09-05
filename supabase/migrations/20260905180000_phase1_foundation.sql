-- Lensello Phase 1: Photography Onboarding & Business Diagnostic Foundation
--
-- Tables for:
-- 1. Photography categories (onboarding select)
-- 2. Business profiles (photographer's business info)
-- 3. Diagnostic responses (questionnaire answers)
-- 4. LENS scores (LEAD, ELEVATE, NURTURE, SCALE tracking)
--
-- This schema supports a multi-photographer SaaS platform where each photographer
-- has a business profile, completes a diagnostic questionnaire once, and we track
-- LENS dimension scores as they progress through marketing campaigns.

-- --------------------------------------------------------------------------
-- photography_categories
-- --------------------------------------------------------------------------
-- Static lookup: the types of photography a photographer can offer.
-- Populated at schema init with standard categories.

create table public.photography_categories (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (length(trim(slug)) > 0),
  label             text not null check (length(trim(label)) > 0),
  description       text,
  icon_emoji        text,
  position          integer not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

create index photography_categories_position_idx on public.photography_categories (position, is_active);

-- Pre-populate with standard categories
insert into public.photography_categories (slug, label, description, icon_emoji, position) values
  ('wedding', 'Wedding', 'Weddings, ceremonies, receptions', '💒', 10),
  ('engagement', 'Engagement', 'Pre-wedding engagement shoots', '💍', 20),
  ('portrait', 'Portrait', 'Individual and group portraits', '🎭', 30),
  ('headshot', 'Headshot', 'Professional headshots & LinkedIn photos', '👤', 40),
  ('family', 'Family', 'Family sessions and group photos', '👨‍👩‍👧‍👦', 50),
  ('newborn', 'Newborn', 'Newborn and infant photography', '👶', 60),
  ('event', 'Event', 'Conferences, galas, parties, corporate events', '🎉', 70),
  ('commercial', 'Commercial', 'Commercial product and brand shoots', '📦', 80),
  ('real_estate', 'Real Estate', 'Property and interior photography', '🏠', 90),
  ('boudoir', 'Boudoir', 'Intimate and boudoir photography', '✨', 100),
  ('sports', 'Sports', 'Sports and action photography', '⚽', 110),
  ('school', 'School', 'School events and yearbook photos', '🎓', 120),
  ('pet', 'Pet', 'Pet and animal photography', '🐾', 130),
  ('product', 'Product', 'E-commerce and product photography', '📷', 140);

comment on table public.photography_categories is
  'Static lookup for photography types. Used during onboarding and in business profile.';

-- --------------------------------------------------------------------------
-- business_profiles
-- --------------------------------------------------------------------------
-- One per photographer. Stores core business info and diagnostic answers.
-- Unlike the existing studio (which is single-tenant), this supports multi-photographer
-- onboarding into Lensello.

create table public.business_profiles (
  id                        uuid primary key default gen_random_uuid(),
  photographer_id           uuid not null references auth.users (id) on delete cascade,

  -- Onboarding step 1: basic info
  business_name             text not null check (length(trim(business_name)) > 0),
  photographer_full_name    text,
  email                     text,
  phone                     text,

  -- Selected photography categories (array of category slugs)
  photography_categories    text[] not null default '{}'
                              check (array_length(photography_categories, 1) is null or array_length(photography_categories, 1) > 0),

  -- Location & service
  primary_location          text,
  service_areas             text,
  travel_willing            boolean not null default false,

  -- Pricing baseline
  avg_booking_value_cents   integer check (avg_booking_value_cents is null or avg_booking_value_cents > 0),
  price_low_cents           integer check (price_low_cents is null or price_low_cents > 0),
  price_high_cents          integer check (price_high_cents is null or price_high_cents > 0),

  -- Diagnostically relevant
  website_url               text,
  instagram_handle          text,

  -- Onboarding progress
  onboarding_step           text not null default 'category_select'
                              check (onboarding_step in ('category_select', 'business_info', 'diagnostic', 'complete')),
  onboarding_completed_at   timestamptz,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint photographer_id_unique unique (photographer_id),
  constraint price_logic check (
    price_low_cents is null or price_high_cents is null or price_low_cents <= price_high_cents
  )
);

create index business_profiles_photographer_idx on public.business_profiles (photographer_id);
create index business_profiles_onboarding_step_idx on public.business_profiles (onboarding_step);
create index business_profiles_created_at_idx on public.business_profiles (created_at desc);

create trigger business_profiles_touch before update on public.business_profiles
  for each row execute function public.touch_updated_at();

comment on table public.business_profiles is
  'Core photographer profile. Single record per photographer, created on signup. Links to auth.users.';
comment on column public.business_profiles.photography_categories is
  'Array of category slugs (e.g., ["wedding", "engagement", "portrait"]) selected during onboarding.';
comment on column public.business_profiles.onboarding_step is
  'Tracks progress: category_select → business_info → diagnostic → complete.';

-- --------------------------------------------------------------------------
-- diagnostic_responses
-- --------------------------------------------------------------------------
-- Questionnaire answers collected once per photographer during onboarding.
-- Provides baseline metrics used to calculate initial LENS scores.

create table public.diagnostic_responses (
  id                                uuid primary key default gen_random_uuid(),
  business_profile_id               uuid not null references public.business_profiles (id) on delete cascade,

  -- LEAD: how prospects find you
  current_lead_volume               text check (current_lead_volume in ('very_few','few','moderate','many','very_many',null)),
  desired_monthly_bookings          integer check (desired_monthly_bookings is null or desired_monthly_bookings > 0),

  -- ELEVATE: your positioning & perceived value
  ideal_client_description          text,
  portfolio_quality               text check (portfolio_quality in ('emerging','developing','strong','exceptional',null)),

  -- NURTURE: conversion & client experience
  response_time_hours               integer check (response_time_hours is null or response_time_hours > 0),
  consultation_process_description  text,
  crm_tool_used                     text,
  email_or_sms_system               text,

  -- SCALE: business metrics & efficiency
  annual_revenue_target_cents       integer check (annual_revenue_target_cents is null or annual_revenue_target_cents > 0),
  current_annual_revenue_cents      integer check (current_annual_revenue_cents is null or current_annual_revenue_cents >= 0),
  seasonal_quiet_periods            text,
  profit_margin_percent             integer check (profit_margin_percent is null or (profit_margin_percent >= 0 and profit_margin_percent <= 100)),

  -- Marketing baseline
  has_website                       boolean,
  has_active_google_business        boolean,
  active_marketing_channels         text,  -- comma-separated or JSON
  current_instagram_followers       integer check (current_instagram_followers is null or current_instagram_followers >= 0),

  -- Integrations
  has_meta_business_account         boolean,
  has_google_ads                    boolean,
  has_stripe_connected              boolean,

  -- Additional context
  biggest_current_challenge         text,
  success_story_or_proud_moment     text,

  completed_at                      timestamptz not null default now(),
  created_at                        timestamptz not null default now(),
  updated_at                        timestamptz not null default now(),

  constraint diagnostic_per_profile unique (business_profile_id)
);

create index diagnostic_responses_profile_idx on public.diagnostic_responses (business_profile_id);
create index diagnostic_responses_completed_idx on public.diagnostic_responses (completed_at desc);

create trigger diagnostic_responses_touch before update on public.diagnostic_responses
  for each row execute function public.touch_updated_at();

comment on table public.diagnostic_responses is
  'One-time diagnostic questionnaire per photographer. Captures baseline for LENS scoring.';
comment on column public.diagnostic_responses.current_lead_volume is
  'Baseline: how many inquiries/leads currently per month?';
comment on column public.diagnostic_responses.desired_monthly_bookings is
  'Goal: how many bookings does the photographer want per month?';

-- --------------------------------------------------------------------------
-- lens_scores
-- --------------------------------------------------------------------------
-- Tracks LENS dimension scores over time.
-- LEAD: visibility and lead generation (traffic, SEO, social reach, ad performance)
-- ELEVATE: perceived value (portfolio, reviews, positioning, website)
-- NURTURE: conversion and client experience (response time, follow-up, consultations)
-- SCALE: business growth (pricing, revenue, profit, capacity, automation, ROI)
--
-- Scores are updated:
-- - On diagnostic completion (baseline snapshot)
-- - On marketing activity (ad performance, campaign completion)
-- - On manual review/update by the photographer or coach
--
-- Each row represents a snapshot at a point in time, allowing trend analysis.

create table public.lens_scores (
  id                    uuid primary key default gen_random_uuid(),
  business_profile_id   uuid not null references public.business_profiles (id) on delete cascade,

  -- Timestamp for trend analysis. One row per update event.
  measured_at           timestamptz not null default now(),

  -- LEAD dimension (0-100 scale)
  -- Visibility: website traffic, SEO keywords ranking, social followers, ad reach
  lead_score            smallint not null default 0 check (lead_score between 0 and 100),
  lead_details          jsonb,  -- e.g., {"monthly_website_visitors": 150, "instagram_followers": 2340, ...}

  -- ELEVATE dimension (0-100 scale)
  -- Perceived value: portfolio quality, review count/rating, brand positioning, website quality
  elevate_score         smallint not null default 0 check (elevate_score between 0 and 100),
  elevate_details       jsonb,  -- e.g., {"portfolio_assets": 45, "google_reviews": 12, "review_avg": 4.8, ...}

  -- NURTURE dimension (0-100 scale)
  -- Conversion: response speed, follow-up rate, CRM usage, email/SMS engagement
  nurture_score         smallint not null default 0 check (nurture_score between 0 and 100),
  nurture_details       jsonb,  -- e.g., {"avg_response_time": 2, "consultation_rate": 0.75, "crmSetup": true, ...}

  -- SCALE dimension (0-100 scale)
  -- Growth: pricing strategy, average transaction value, profit margin, capacity utilization, automation
  scale_score           smallint not null default 0 check (scale_score between 0 and 100),
  scale_details         jsonb,  -- e.g., {"avg_booking_value": 350000, "annual_revenue": 8500000, "profit_margin": 45, ...}

  -- Overall (average of the four)
  overall_score         smallint not null default 0 check (overall_score between 0 and 100),

  -- Source of this measurement
  source                text not null default 'diagnostic'
                          check (source in ('diagnostic', 'campaign_impact', 'manual_review', 'system_update')),

  -- Optional note explaining why scores changed
  note                  text,

  created_at            timestamptz not null default now()
);

create index lens_scores_profile_idx on public.lens_scores (business_profile_id, measured_at desc);
create index lens_scores_source_idx on public.lens_scores (source);

comment on table public.lens_scores is
  'LENS dimension scores (LEAD, ELEVATE, NURTURE, SCALE) tracked over time for trend analysis and intervention planning.';
comment on column public.lens_scores.lead_details is
  'JSON snapshot of lead-generation metrics at time of measurement.';
comment on column public.lens_scores.elevate_details is
  'JSON snapshot of positioning and perceived-value metrics.';
comment on column public.lens_scores.nurture_details is
  'JSON snapshot of conversion and client-experience metrics.';
comment on column public.lens_scores.scale_details is
  'JSON snapshot of business growth and efficiency metrics.';

-- --------------------------------------------------------------------------
-- row level security
-- --------------------------------------------------------------------------

alter table public.photography_categories enable row level security;
alter table public.business_profiles enable row level security;
alter table public.diagnostic_responses enable row level security;
alter table public.lens_scores enable row level security;

-- photography_categories: world-readable (it's a static lookup)
create policy photography_categories_read on public.photography_categories
  for select to authenticated using (true);

-- business_profiles: photographers can read/update their own; staff can read all
create policy business_profiles_read_own on public.business_profiles
  for select to authenticated
  using (photographer_id = auth.uid() or public.is_staff());

create policy business_profiles_update_own on public.business_profiles
  for update to authenticated
  using (photographer_id = auth.uid() or public.is_staff())
  with check (photographer_id = auth.uid() or public.is_staff());

create policy business_profiles_insert_own on public.business_profiles
  for insert to authenticated
  with check (photographer_id = auth.uid());

-- diagnostic_responses: photographers can read/update their own; staff can read all
create policy diagnostic_responses_read_own on public.diagnostic_responses
  for select to authenticated
  using (
    business_profile_id in (
      select id from public.business_profiles
      where photographer_id = auth.uid() or public.is_staff()
    )
  );

create policy diagnostic_responses_insert_own on public.diagnostic_responses
  for insert to authenticated
  with check (
    business_profile_id in (
      select id from public.business_profiles where photographer_id = auth.uid()
    )
  );

create policy diagnostic_responses_update_own on public.diagnostic_responses
  for update to authenticated
  using (
    business_profile_id in (
      select id from public.business_profiles
      where photographer_id = auth.uid() or public.is_staff()
    )
  )
  with check (
    business_profile_id in (
      select id from public.business_profiles
      where photographer_id = auth.uid() or public.is_staff()
    )
  );

-- lens_scores: photographers can read their own; staff can read all
create policy lens_scores_read_own on public.lens_scores
  for select to authenticated
  using (
    business_profile_id in (
      select id from public.business_profiles
      where photographer_id = auth.uid() or public.is_staff()
    )
  );

create policy lens_scores_insert_staff on public.lens_scores
  for insert to authenticated
  with check (public.is_staff());
