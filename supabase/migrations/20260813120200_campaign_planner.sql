-- Campaign playbooks, checklists and the calendar.  [agent C]
--
-- The gap the client described: creating a campaign today asks for a name and an
-- objective, then expects the photographer to already know what a campaign is.
-- What she wants is the thought process handed to her — "wedding season ends in
-- September, so run a mini campaign for the wedding fairs and book meetings at
-- the fair" — as a template she picks from a dropdown and then fills in.
--
-- So: a playbook is a reusable plan (audience prompt, brief prompt, and a set of
-- tasks at day offsets). Applying one to a campaign copies its tasks in as dated
-- checklist items. Copied, not referenced — editing next year's template must
-- not rewrite what was actually done this year.
--
-- Those dated tasks, plus campaign_posts.scheduled_for and gigs, are what the
-- calendar draws. There is no separate calendar table; a fourth copy of the same
-- dates would only drift.

set lock_timeout = '10s';

-- ---------------------------------------------------------------------------
-- playbooks
-- ---------------------------------------------------------------------------

create table public.campaign_playbooks (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  summary       text,

  -- The dropdown she asked for. 'evergreen' is the escape hatch for plans that
  -- are not tied to a point in the year.
  season        text not null default 'evergreen'
                  check (season in ('wedding_fair', 'engagement', 'new_year',
                                    'valentines', 'spring', 'summer', 'autumn',
                                    'christmas', 'evergreen', 'other')),

  -- Matches campaigns.objective so applying a playbook can prefill it.
  objective     text
                  check (objective is null or objective in
                    ('book_more_shoots', 'fill_a_date', 'promote_a_package',
                     'showcase_portfolio', 'seasonal_promo', 'referral_push')),

  -- Prefilled prose, not placeholders — a blank "who is this for?" box is the
  -- thing that stops campaigns getting written.
  audience_template text,
  brief_template    text,

  duration_days     integer not null default 14 check (duration_days > 0),
  -- Which weekdays this plan posts on: 0 = Sunday … 6 = Saturday. The direct
  -- answer to "more control over what populates the calendar, Monday, Tuesday,
  -- Wednesday".
  posting_days      smallint[] not null default '{1,3,5}',
  platforms         text[] not null default '{}',

  -- Photographers are visual people; a plain list of plan names reads as admin.
  cover_emoji       text,
  accent_color      text check (accent_color is null or accent_color ~ '^#[0-9a-fA-F]{6}$'),

  -- Ships with the app and cannot be deleted from the UI, only copied.
  is_builtin        boolean not null default false,
  is_active         boolean not null default true,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index campaign_playbooks_season_idx
  on public.campaign_playbooks (season, is_active);

create trigger campaign_playbooks_touch before update on public.campaign_playbooks
  for each row execute function public.touch_updated_at();

-- A step in the plan, positioned relative to the campaign start so one template
-- works in any year. Negative offsets are the run-up: "book your stand" happens
-- three weeks before the fair.
create table public.playbook_tasks (
  id          uuid primary key default gen_random_uuid(),
  playbook_id uuid not null references public.campaign_playbooks (id) on delete cascade,

  day_offset  integer not null default 0,
  title       text not null,
  detail      text,

  kind        text not null default 'admin'
                check (kind in ('post', 'story', 'email', 'outreach', 'ad',
                                'call', 'shoot', 'admin', 'print')),
  -- For 'post' and 'story' tasks: which platform. Null for the rest.
  platform    text check (platform is null or platform in
                ('instagram', 'facebook', 'tiktok', 'pinterest')),

  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index playbook_tasks_playbook_idx
  on public.playbook_tasks (playbook_id, day_offset, sort_order);

-- ---------------------------------------------------------------------------
-- campaigns gain a plan
-- ---------------------------------------------------------------------------

alter table public.campaigns
  -- Which playbook this came from, for reporting. Set null on delete rather than
  -- cascade: deleting a template must never delete real campaigns.
  add column playbook_id  uuid references public.campaign_playbooks (id) on delete set null,
  add column posting_days smallint[] not null default '{1,3,5}',
  -- Local time of day for generated posts. One time per campaign is enough;
  -- per-post overrides live on campaign_posts.scheduled_for.
  add column posting_time time not null default '10:00',
  add column cover_asset_id uuid references public.assets (id) on delete set null;

create index campaigns_playbook_idx on public.campaigns (playbook_id)
  where playbook_id is not null;

comment on column public.campaigns.posting_days is
  'Weekdays this campaign posts on, 0 = Sunday. Drives calendar generation.';

-- ---------------------------------------------------------------------------
-- the checklist
-- ---------------------------------------------------------------------------

-- "A checklist would be better (CRM stuff in it)". These are the dated,
-- tickable items — copied from a playbook or added by hand — and they are what
-- the calendar shows alongside shoots and scheduled posts.
create table public.campaign_tasks (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.campaigns (id) on delete cascade,

  -- Provenance only. Nulled if the template row is later removed; the task
  -- itself is a copy and survives independently.
  playbook_task_id uuid references public.playbook_tasks (id) on delete set null,

  title         text not null,
  detail        text,
  kind          text not null default 'admin'
                  check (kind in ('post', 'story', 'email', 'outreach', 'ad',
                                  'call', 'shoot', 'admin', 'print')),

  due_on        date,
  due_time      time,

  -- The CRM hook: a task can be about a specific person, so "book meetings at
  -- the fair" becomes real follow-ups rather than a note.
  client_id     uuid references public.clients (id) on delete set null,
  -- And a task can be the thing that produces a post.
  post_id       uuid references public.campaign_posts (id) on delete set null,

  assigned_to   uuid references public.profiles (id) on delete set null,
  -- Timestamp rather than a boolean: when it was ticked is worth knowing.
  done_at       timestamptz,

  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index campaign_tasks_campaign_idx
  on public.campaign_tasks (campaign_id, due_on, sort_order);
-- The calendar's main query: everything due in a window, done or not.
create index campaign_tasks_due_idx
  on public.campaign_tasks (due_on) where due_on is not null;

create trigger campaign_tasks_touch before update on public.campaign_tasks
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- row level security
-- ---------------------------------------------------------------------------

alter table public.campaign_playbooks enable row level security;
alter table public.playbook_tasks     enable row level security;
alter table public.campaign_tasks     enable row level security;

create policy campaign_playbooks_staff_all on public.campaign_playbooks
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy playbook_tasks_staff_all on public.playbook_tasks
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy campaign_tasks_staff_all on public.campaign_tasks
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
