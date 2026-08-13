-- Automations and API keys.  [agent F]
--
-- "You can build workflows — build automations into the platform (API key)."
--
-- A trigger, an ordered list of steps, and a record of every run. Steps are
-- rows rather than one JSON blob so a run can point at the exact step that
-- failed, which is the difference between a debuggable automation and a black
-- box that "didn't work".
--
-- Two safety properties are schema-level, not app-level, because an automation
-- that misfires sends real email to real clients:
--   * `enabled` defaults to false — a newly built automation never runs until
--     someone turns it on;
--   * every run is recorded, including skipped ones, so "why did this client get
--     three messages" has an answer.

set lock_timeout = '10s';

-- ---------------------------------------------------------------------------
-- definitions
-- ---------------------------------------------------------------------------

create table public.automations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,

  trigger_kind  text not null
                  check (trigger_kind in ('message_received', 'inquiry_created',
                                          'client_stage_changed', 'gig_booked',
                                          'gig_upcoming', 'gallery_viewed',
                                          'gallery_approved', 'order_paid',
                                          'campaign_task_due', 'schedule',
                                          'webhook', 'manual')),
  -- Shape depends on trigger_kind: a cron expression for 'schedule', a channel
  -- filter for 'message_received', days-before for 'gig_upcoming'.
  trigger_config jsonb not null default '{}',

  -- Off until switched on, deliberately.
  enabled       boolean not null default false,

  -- Guard rails against a loop. Null means unlimited, which the UI should
  -- discourage.
  max_runs_per_day integer check (max_runs_per_day is null or max_runs_per_day > 0),

  last_run_at   timestamptz,
  run_count     integer not null default 0,

  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index automations_trigger_idx
  on public.automations (trigger_kind, enabled);

create trigger automations_touch before update on public.automations
  for each row execute function public.touch_updated_at();

create table public.automation_steps (
  id            uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations (id) on delete cascade,

  sort_order    integer not null default 0,

  action_kind   text not null
                  check (action_kind in ('send_email', 'send_sms', 'send_dm',
                                         'create_task', 'create_client',
                                         'update_client_stage', 'add_tag',
                                         'draft_reply', 'notify_staff',
                                         'webhook', 'wait', 'branch')),
  config        jsonb not null default '{}',

  -- A failed "notify staff" should not abandon the rest of the sequence; a
  -- failed "create the client record" should.
  continue_on_error boolean not null default false,

  created_at    timestamptz not null default now()
);

create index automation_steps_order_idx
  on public.automation_steps (automation_id, sort_order);

-- ---------------------------------------------------------------------------
-- runs
-- ---------------------------------------------------------------------------

create table public.automation_runs (
  id            uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations (id) on delete cascade,

  status        text not null default 'running'
                  check (status in ('running', 'succeeded', 'failed',
                                    'skipped', 'cancelled')),
  -- Why a run was skipped: rate limit, filter did not match, automation off.
  skip_reason   text,

  trigger_payload jsonb,
  error         text,

  started_at    timestamptz not null default now(),
  finished_at   timestamptz
);

create index automation_runs_recent_idx
  on public.automation_runs (automation_id, started_at desc);
-- Supports the per-day rate limit check without scanning the whole history.
create index automation_runs_window_idx
  on public.automation_runs (started_at desc);

create table public.automation_run_steps (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references public.automation_runs (id) on delete cascade,
  -- Null if the definition was edited after the run. The run's own record of
  -- what happened stays readable regardless.
  step_id     uuid references public.automation_steps (id) on delete set null,

  sort_order  integer not null default 0,
  action_kind text not null,

  status      text not null default 'running'
                check (status in ('running', 'succeeded', 'failed', 'skipped')),
  output      jsonb,
  error       text,

  started_at  timestamptz not null default now(),
  finished_at timestamptz
);

create index automation_run_steps_run_idx
  on public.automation_run_steps (run_id, sort_order);

-- ---------------------------------------------------------------------------
-- api keys
-- ---------------------------------------------------------------------------

-- The key is shown once at creation and never again. Only a sha256 of it is
-- stored: a database leak must not hand over working credentials to the API.
-- `key_prefix` is the first few characters, kept in clear so the UI can say
-- which key is which without being able to reconstruct it.
create table public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,

  key_prefix   text not null,
  key_hash     text not null unique,

  -- Least privilege by default: a key with no scopes can do nothing.
  scopes       text[] not null default '{}',

  last_used_at timestamptz,
  expires_at   timestamptz,
  -- Revoked rather than deleted, so audit_events referencing it still resolve.
  revoked_at   timestamptz,

  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index api_keys_active_idx on public.api_keys (revoked_at, expires_at);

comment on table public.api_keys is
  'Only sha256(key) is stored. key_prefix is display-only and cannot reconstruct the key.';

-- ---------------------------------------------------------------------------
-- row level security
-- ---------------------------------------------------------------------------

alter table public.automations          enable row level security;
alter table public.automation_steps     enable row level security;
alter table public.automation_runs      enable row level security;
alter table public.automation_run_steps enable row level security;
alter table public.api_keys             enable row level security;

create policy automations_staff_all on public.automations
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy automation_steps_staff_all on public.automation_steps
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy automation_runs_staff_select on public.automation_runs
  for select to authenticated using (public.is_staff());

create policy automation_run_steps_staff_select on public.automation_run_steps
  for select to authenticated using (public.is_staff());

-- Runs are written by the executor through the service role, never by a browser
-- session, so there is no staff INSERT policy on the two run tables.

-- Staff may list and revoke keys. The hash column is unavoidably readable by
-- anyone who can list them, which is why it is a hash.
create policy api_keys_staff_all on public.api_keys
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
