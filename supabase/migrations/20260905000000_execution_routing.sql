-- Phase 3: Execution Routing System
-- Routes work to the lowest-cost, most-scalable layer
-- LENSELLO DOES IT: Automation (lead capture, follow-up, nurture, CRM, workflows, reporting)
-- AI DOES IT: Intelligence without senior judgment (draft campaigns, analyze, recommend, identify opportunities)
-- TEAM DOES IT: Execution without senior strategy (setup, scheduling, config, implementation)
-- SENIOR STRATEGIST DOES IT: Judgment calls (business transformation, brand positioning, pricing, diagnosis, offer dev, pivots, strategy)

set lock_timeout = '10s';

-- Create execution layers enum
create type public.execution_layer as enum (
  'lensello_automation',
  'ai_intelligence',
  'team_execution',
  'senior_strategist'
);

-- Create action types enum
create type public.action_type as enum (
  -- Lensello automation
  'auto_lead_capture',
  'auto_follow_up_email',
  'auto_nurture_campaign',
  'auto_schedule_reminder',
  'auto_crm_update',
  'auto_workflow_trigger',
  'auto_report_generate',

  -- AI intelligence
  'ai_draft_campaign',
  'ai_analyze_performance',
  'ai_recommend_content',
  'ai_suggest_follow_up',
  'ai_identify_opportunity',
  'ai_generate_variants',
  'ai_audience_analysis',

  -- Team execution
  'team_setup_campaign',
  'team_landing_page_change',
  'team_content_schedule',
  'team_config_integration',
  'team_implement_workflow',
  'team_update_crm',
  'team_audience_segment',

  -- Senior strategist
  'strategy_business_transformation',
  'strategy_brand_positioning',
  'strategy_pricing_review',
  'strategy_complex_diagnosis',
  'strategy_offer_development',
  'strategy_pivot_decision',
  'strategy_mentoring'
);

-- Create priority level enum
create type public.priority_level as enum (
  'red',
  'amber',
  'green'
);

-- Create action status enum
create type public.action_status as enum (
  'pending',
  'in_progress',
  'completed',
  'escalated',
  'cancelled'
);

-- Main action_queue table
create table public.action_queue (
  id uuid primary key default gen_random_uuid(),
  photographer_id uuid not null references public.profiles(id) on delete cascade,

  action_type public.action_type not null,
  execution_layer public.execution_layer not null,

  -- Assignment and status
  assigned_to text,  -- null = not yet assigned, 'lensello' = automated, 'ai' = AI-generated, 'team' = team member, 'strategist' = Fiona
  status public.action_status not null default 'pending',
  priority_level public.priority_level not null default 'green',

  -- Action details
  title text not null,
  description text,
  context jsonb,  -- structured data specific to action type (recommendations, data, etc.)

  -- AI draft (if applicable)
  ai_draft text,
  ai_draft_metadata jsonb,  -- confidence, variants, alternatives

  -- Escalation tracking
  escalation_reason text,
  escalation_triggered_at timestamptz,
  escalation_threshold_days int default 7,  -- escalate to human if pending > N days

  -- Execution metadata
  execution_result jsonb,
  executed_by text,  -- null, 'automation', email, or 'strategist'
  executed_at timestamptz,

  -- Timeline
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  due_at timestamptz,
  completed_at timestamptz,

  -- Audit
  created_by text,
  metadata jsonb
);

-- Indexes for efficient querying
create index action_queue_photographer_id_idx on public.action_queue(photographer_id);
create index action_queue_status_idx on public.action_queue(status);
create index action_queue_priority_idx on public.action_queue(priority_level);
create index action_queue_execution_layer_idx on public.action_queue(execution_layer);
create index action_queue_assigned_to_idx on public.action_queue(assigned_to);
create index action_queue_escalation_triggered_idx on public.action_queue(escalation_triggered_at);
create index action_queue_created_at_idx on public.action_queue(created_at desc);

-- RLS policies
alter table public.action_queue enable row level security;

create policy "profiles can read their own actions"
  on public.action_queue
  for select
  using (
    (auth.uid() = photographer_id) or
    (auth.uid() in (select id from public.profiles where role = 'owner'))
  );

create policy "service role can manage actions"
  on public.action_queue
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Execution audit log
create table public.action_execution_log (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.action_queue(id) on delete cascade,

  status public.action_status not null,
  executed_by text,
  executed_at timestamptz not null default now(),

  result jsonb,
  error text,

  metadata jsonb
);

-- Index for audit trail
create index action_execution_log_action_id_idx on public.action_execution_log(action_id);
create index action_execution_log_executed_at_idx on public.action_execution_log(executed_at desc);

-- RLS for audit log
alter table public.action_execution_log enable row level security;

create policy "profiles can read their action logs"
  on public.action_execution_log
  for select
  using (
    (select photographer_id from public.action_queue where id = action_id) = auth.uid() or
    (auth.uid() in (select id from public.profiles where role = 'owner'))
  );

-- Dashboard state: memoized dashboard metrics (refreshed hourly)
create table public.dashboard_state (
  id uuid primary key default gen_random_uuid(),
  photographer_id uuid not null references public.profiles(id) on delete cascade,

  -- Snapshot metrics (from Phase 2 diagnostic + realtime queries)
  new_enquiries_this_month int,
  consultations_booked_this_month int,
  bookings_this_month int,
  pipeline_value_cents int,

  -- Priorities from diagnostic framework (Phase 2)
  top_3_priorities jsonb,  -- array of {area, status, insight, recommended_action}

  -- Recommended next action
  recommended_action jsonb,  -- {action_type, title, description, impact, estimated_time_minutes}

  -- Generated at
  generated_at timestamptz not null default now(),
  refreshed_at timestamptz
);

-- Index for dashboard queries
create index dashboard_state_photographer_id_idx on public.dashboard_state(photographer_id);
create index dashboard_state_refreshed_at_idx on public.dashboard_state(refreshed_at desc);

-- RLS for dashboard state
alter table public.dashboard_state enable row level security;

create policy "profiles can read their dashboard state"
  on public.dashboard_state
  for select
  using (
    (photographer_id = auth.uid()) or
    (auth.uid() in (select id from public.profiles where role = 'owner'))
  );

create policy "service role can manage dashboard state"
  on public.dashboard_state
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Comments
comment on table public.action_queue is
  'Phase 3 execution routing: work assigned to the appropriate layer (automation, AI, team, or strategist)';

comment on column public.action_queue.execution_layer is
  'LENSELLO (automation) | AI (intelligence) | TEAM (execution) | SENIOR (strategy)';

comment on column public.action_queue.priority_level is
  'RED: urgent, AMBER: important, GREEN: nice-to-have';

comment on column public.action_queue.assigned_to is
  'null (unassigned), "lensello" (automated), "ai" (AI-generated), team member email, "strategist"';

comment on column public.action_queue.escalation_reason is
  'Reason action was escalated to human review (e.g., "pending for 7+ days", "low success rate")';

comment on table public.dashboard_state is
  'Memoized dashboard metrics and priorities, refreshed hourly by cron job';
