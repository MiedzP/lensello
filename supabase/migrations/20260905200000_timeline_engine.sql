-- Timeline Engine: Automated Scheduling System
--
-- Tables for:
-- 1. timeline_templates — Reusable templates (Wedding, Engagement, Follow-up, Campaign, etc.)
-- 2. timeline_milestones — Individual steps within a timeline (day 0, day 3, day 14, day 30, etc.)
-- 3. milestone_actions — Specific tasks/actions at each milestone (send email, create task, SMS, call reminder)
-- 4. scheduled_timelines — Active timelines per project/client (instantiated from template)
-- 5. scheduled_actions — Queue of actions to execute (scheduled date + integration with Phase 3 execution routing)
-- 6. action_triggers — Conditions that trigger timeline start (booking confirmed, payment received, project created, etc.)
--
-- This is the CORE scheduling engine that feeds into Phase 3 execution routing.

set lock_timeout = '10s';

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Timeline template categories
create type public.template_category as enum (
  'photography_workflow',  -- Wedding, Engagement, Portrait, Event, etc.
  'client_journey',        -- New Lead, Past Client Reactivation, etc.
  'campaign_cycle',        -- Meta Campaign, Email Sequence, etc.
  'custom'                 -- User-defined custom template
);

-- Milestone day calculation mode
create type public.day_calc_mode as enum (
  'calendar_days',         -- Absolute days (day 0, day 3, day 14)
  'business_days',         -- Exclude weekends (Mon-Fri only)
  'relative_to_previous'   -- Days after previous milestone completion
);

-- Timeline status
create type public.timeline_status as enum (
  'draft',                 -- Not yet active
  'active',                -- Currently running
  'paused',                -- Temporarily stopped
  'completed',             -- All milestones done
  'cancelled'              -- Abandoned
);

-- Action trigger types
create type public.trigger_type as enum (
  'booking_confirmed',     -- Booking created in system
  'payment_received',      -- Payment confirmed
  'project_created',       -- New project/inquiry created
  'milestone_completed',   -- Previous milestone completed
  'manual',                -- Manually started
  'api'                    -- External API trigger
);

-- ============================================================================
-- 1. TIMELINE TEMPLATES
-- ============================================================================

create table public.timeline_templates (
  id                uuid primary key default gen_random_uuid(),
  photographer_id   uuid not null references public.profiles(id) on delete cascade,

  -- Template metadata
  slug              text not null,
  name              text not null,
  description       text,
  category          public.template_category not null default 'custom',

  -- Template configuration
  is_active         boolean not null default true,
  is_default        boolean not null default false,
  duration_days     integer not null check (duration_days > 0),

  -- Trigger configuration
  auto_trigger_on   public.trigger_type[],  -- Which events auto-start this timeline

  -- Timezone for date calculations
  timezone          text not null default 'UTC',

  -- Metadata
  metadata          jsonb,  -- Custom fields, notes, tags
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint photographer_slug_unique unique (photographer_id, slug)
);

create index timeline_templates_photographer_id_idx on public.timeline_templates(photographer_id);
create index timeline_templates_category_idx on public.timeline_templates(category);
create index timeline_templates_is_active_idx on public.timeline_templates(is_active);

alter table public.timeline_templates enable row level security;

create policy "profiles can read/manage their own templates"
  on public.timeline_templates
  for all
  using (photographer_id = auth.uid() or auth.uid() in (select id from public.profiles where role = 'owner'))
  with check (photographer_id = auth.uid() or auth.uid() in (select id from public.profiles where role = 'owner'));

create policy "service role can manage templates"
  on public.timeline_templates
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

comment on table public.timeline_templates is
  'Reusable timeline templates: Wedding, Engagement, Follow-up, Campaign, etc. Base for scheduled_timelines.';

-- ============================================================================
-- 2. TIMELINE MILESTONES
-- ============================================================================

create table public.timeline_milestones (
  id                uuid primary key default gen_random_uuid(),
  template_id       uuid not null references public.timeline_templates(id) on delete cascade,

  -- Milestone sequence
  position          integer not null check (position >= 0),
  title             text not null,
  description       text,

  -- Day calculation
  day_number        integer not null check (day_number >= 0),
  day_calc_mode     public.day_calc_mode not null default 'calendar_days',

  -- Optional: Repeat every N days after start
  repeat_every_days integer,  -- NULL = no repeat, 7 = weekly, 14 = bi-weekly, etc.
  repeat_end_day    integer,  -- NULL = repeat until timeline ends, else until this day

  -- Scheduling hints
  preferred_time    time,  -- Preferred time of day (e.g., 9:00 AM for email)
  timezone          text,  -- Inherit from template or override

  metadata          jsonb,
  created_at        timestamptz not null default now(),

  constraint milestone_position_unique unique (template_id, position)
);

create index timeline_milestones_template_id_idx on public.timeline_milestones(template_id);

comment on table public.timeline_milestones is
  'Individual steps in a timeline: day 0, day 3, day 14, day 30, etc. Ordered by position.';

-- ============================================================================
-- 3. MILESTONE ACTIONS
-- ============================================================================

create table public.milestone_actions (
  id                uuid primary key default gen_random_uuid(),
  milestone_id      uuid not null references public.timeline_milestones(id) on delete cascade,

  -- Action classification (maps to action_queue.action_type)
  action_type       public.action_type not null,  -- From execution_routing
  priority_level    public.priority_level not null default 'green',

  -- Action template/content
  title             text not null,
  description       text,
  template_content  text,  -- Email body template, SMS template, task description, etc.

  -- Templating variables available
  template_variables text[],  -- e.g., {client_name, project_type, booking_date, etc.}

  -- Configuration specific to action type
  action_config     jsonb,  -- {email: {subject, from_template}, sms: {provider}, task: {assigned_to}}

  -- Sequence within milestone
  position          integer not null default 0,

  metadata          jsonb,
  created_at        timestamptz not null default now(),

  constraint action_position_unique unique (milestone_id, position)
);

create index milestone_actions_milestone_id_idx on public.milestone_actions(milestone_id);

comment on table public.milestone_actions is
  'Specific tasks at each milestone: send email, create task, send SMS, call reminder, etc.';

-- ============================================================================
-- 4. SCHEDULED TIMELINES
-- ============================================================================

create table public.scheduled_timelines (
  id                uuid primary key default gen_random_uuid(),
  photographer_id   uuid not null references public.profiles(id) on delete cascade,
  template_id       uuid not null references public.timeline_templates(id) on delete restrict,

  -- Reference to what triggered this timeline
  trigger_type      public.trigger_type not null,
  trigger_context   jsonb,  -- {booking_id, project_id, client_id, etc.}

  -- Status tracking
  status            public.timeline_status not null default 'active',
  started_at        timestamptz not null default now(),
  paused_at         timestamptz,
  completed_at      timestamptz,
  cancelled_at      timestamptz,
  cancelled_reason  text,

  -- Scheduling reference
  timezone          text not null default 'UTC',
  start_date        date not null,  -- Base date for calculating milestone dates

  -- Metadata for rendering and tracking
  context           jsonb,  -- {client_name, project_type, booking_date, event_date, etc.}
  metadata          jsonb,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index scheduled_timelines_photographer_id_idx on public.scheduled_timelines(photographer_id);
create index scheduled_timelines_template_id_idx on public.scheduled_timelines(template_id);
create index scheduled_timelines_status_idx on public.scheduled_timelines(status);
create index scheduled_timelines_start_date_idx on public.scheduled_timelines(start_date);
create index scheduled_timelines_started_at_idx on public.scheduled_timelines(started_at desc);

alter table public.scheduled_timelines enable row level security;

create policy "profiles can read/manage their own timelines"
  on public.scheduled_timelines
  for all
  using (photographer_id = auth.uid() or auth.uid() in (select id from public.profiles where role = 'owner'))
  with check (photographer_id = auth.uid() or auth.uid() in (select id from public.profiles where role = 'owner'));

create policy "service role can manage timelines"
  on public.scheduled_timelines
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

comment on table public.scheduled_timelines is
  'Active timelines per project/client. Instantiated from a template when trigger fires.';

-- ============================================================================
-- 5. SCHEDULED ACTIONS
-- ============================================================================

create table public.scheduled_actions (
  id                uuid primary key default gen_random_uuid(),
  photographer_id   uuid not null references public.profiles(id) on delete cascade,
  scheduled_timeline_id uuid not null references public.scheduled_timelines(id) on delete cascade,
  milestone_id      uuid not null references public.timeline_milestones(id) on delete cascade,
  milestone_action_id uuid not null references public.milestone_actions(id) on delete cascade,

  -- References to execution routing
  action_queue_id   uuid references public.action_queue(id) on delete set null,

  -- Calculated execution details
  scheduled_date    date not null,
  scheduled_time    time,  -- NULL = any time that day
  scheduled_at      timestamptz,  -- Combined date + time in target timezone, UTC stored

  -- Preparation
  is_prepared       boolean not null default false,
  prepared_at       timestamptz,
  prepared_content  jsonb,  -- Rendered template with actual values

  -- Tracking
  is_queued         boolean not null default false,
  queued_at         timestamptz,
  executed_at       timestamptz,

  status            public.action_status not null default 'pending',

  metadata          jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index scheduled_actions_photographer_id_idx on public.scheduled_actions(photographer_id);
create index scheduled_actions_timeline_id_idx on public.scheduled_actions(scheduled_timeline_id);
create index scheduled_actions_scheduled_date_idx on public.scheduled_actions(scheduled_date);
create index scheduled_actions_scheduled_at_idx on public.scheduled_actions(scheduled_at);
create index scheduled_actions_status_idx on public.scheduled_actions(status);
create index scheduled_actions_is_queued_idx on public.scheduled_actions(is_queued);
create index scheduled_actions_is_prepared_idx on public.scheduled_actions(is_prepared);

-- Find all due actions for cron job
create index scheduled_actions_due_idx on public.scheduled_actions(scheduled_at)
  where status = 'pending' and is_queued = false and scheduled_at <= now();

alter table public.scheduled_actions enable row level security;

create policy "profiles can read their scheduled actions"
  on public.scheduled_actions
  for select
  using (photographer_id = auth.uid() or auth.uid() in (select id from public.profiles where role = 'owner'))
  with check (photographer_id = auth.uid() or auth.uid() in (select id from public.profiles where role = 'owner'));

create policy "service role can manage scheduled actions"
  on public.scheduled_actions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

comment on table public.scheduled_actions is
  'Queue of actions to execute. Calculated from scheduled_timelines. Feeds into Phase 3 execution routing.';

-- ============================================================================
-- 6. ACTION TRIGGERS
-- ============================================================================

create table public.action_triggers (
  id                uuid primary key default gen_random_uuid(),
  photographer_id   uuid not null references public.profiles(id) on delete cascade,
  template_id       uuid not null references public.timeline_templates(id) on delete cascade,

  -- What event triggers this
  trigger_type      public.trigger_type not null,
  trigger_table     text not null,  -- 'bookings', 'payments', 'projects', 'inquiries', etc.

  -- Conditions (optional JSON filter)
  trigger_conditions jsonb,  -- {booking_type: 'wedding', min_value_cents: 100000} etc.

  -- Should this auto-activate? Or require manual approval?
  auto_activate     boolean not null default true,

  -- If false, create action_queue.notify to let photographer review/approve first
  requires_approval boolean not null default false,

  metadata          jsonb,
  created_at        timestamptz not null default now(),

  constraint trigger_unique unique (photographer_id, template_id, trigger_type)
);

create index action_triggers_photographer_id_idx on public.action_triggers(photographer_id);
create index action_triggers_template_id_idx on public.action_triggers(template_id);
create index action_triggers_trigger_type_idx on public.action_triggers(trigger_type);

alter table public.action_triggers enable row level security;

create policy "profiles can read/manage their own triggers"
  on public.action_triggers
  for all
  using (photographer_id = auth.uid() or auth.uid() in (select id from public.profiles where role = 'owner'))
  with check (photographer_id = auth.uid() or auth.uid() in (select id from public.profiles where role = 'owner'));

create policy "service role can manage triggers"
  on public.action_triggers
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

comment on table public.action_triggers is
  'Conditions that auto-start timelines: booking confirmed, payment received, project created, etc.';

-- ============================================================================
-- COMMENTS
-- ============================================================================

comment on type public.template_category is
  'Categories of timeline templates: photography workflows, client journeys, campaign cycles, custom';

comment on type public.day_calc_mode is
  'How to calculate milestone dates: calendar_days, business_days, or relative to previous milestone';

comment on type public.trigger_type is
  'Events that can trigger a timeline: booking_confirmed, payment_received, project_created, milestone_completed, manual, api';

-- ============================================================================
-- GRANTS
-- ============================================================================

grant select, insert, update on public.timeline_templates to authenticated;
grant select, insert, update on public.timeline_milestones to authenticated;
grant select, insert, update on public.milestone_actions to authenticated;
grant select, insert, update on public.scheduled_timelines to authenticated;
grant select, insert, update on public.scheduled_actions to authenticated;
grant select, insert, update on public.action_triggers to authenticated;

grant all on public.timeline_templates to service_role;
grant all on public.timeline_milestones to service_role;
grant all on public.milestone_actions to service_role;
grant all on public.scheduled_timelines to service_role;
grant all on public.scheduled_actions to service_role;
grant all on public.action_triggers to service_role;
