-- Lensello Marketing Diagnostic Framework
-- Adds 6-area diagnostic assessment to business_profile

set lock_timeout = '10s';

-- Extend business_profile with diagnostic assessment columns
alter table public.business_profile
  add column if not exists diagnostic_position_status text check (diagnostic_position_status is null or diagnostic_position_status in ('red', 'amber', 'green')),
  add column if not exists diagnostic_product_status text check (diagnostic_product_status is null or diagnostic_product_status in ('red', 'amber', 'green')),
  add column if not exists diagnostic_visibility_status text check (diagnostic_visibility_status is null or diagnostic_visibility_status in ('red', 'amber', 'green')),
  add column if not exists diagnostic_conversion_status text check (diagnostic_conversion_status is null or diagnostic_conversion_status in ('red', 'amber', 'green')),
  add column if not exists diagnostic_nurture_status text check (diagnostic_nurture_status is null or diagnostic_nurture_status in ('red', 'amber', 'green')),
  add column if not exists diagnostic_performance_status text check (diagnostic_performance_status is null or diagnostic_performance_status in ('red', 'amber', 'green')),

  -- Store diagnostic insights
  add column if not exists diagnostic_position_insight text,
  add column if not exists diagnostic_product_insight text,
  add column if not exists diagnostic_visibility_insight text,
  add column if not exists diagnostic_conversion_insight text,
  add column if not exists diagnostic_nurture_insight text,
  add column if not exists diagnostic_performance_insight text,

  -- Track when diagnostic was last assessed
  add column if not exists diagnostic_last_assessed timestamptz;

comment on column public.business_profile.diagnostic_position_status is
  'POSITION: Brand, differentiation, ideal client, authority (red/amber/green)';

comment on column public.business_profile.diagnostic_product_status is
  'PRODUCT: Packages, pricing, profitability (red/amber/green)';

comment on column public.business_profile.diagnostic_visibility_status is
  'VISIBILITY: SEO, social, venues, Meta, Google (red/amber/green)';

comment on column public.business_profile.diagnostic_conversion_status is
  'CONVERSION: Website, enquiry journey, consultations (red/amber/green)';

comment on column public.business_profile.diagnostic_nurture_status is
  'NURTURE: CRM, follow-up, email, remarketing (red/amber/green)';

comment on column public.business_profile.diagnostic_performance_status is
  'PERFORMANCE: Leads, bookings, conversion, revenue (red/amber/green)';
