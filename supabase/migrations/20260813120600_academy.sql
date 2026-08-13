-- The marketing academy, and what it learns about the business.  [agent G]
--
-- "Platform where the photographer has the training — SEO, GEO, SWOT analysis,
-- marketing promotions 7 Ps, nurturing expectations, workflows, optimizing brand
-- positioning, website flow, customer journey, landing pages — templates."
--
-- Structure only: modules, lessons, worksheets, templates, progress. The lesson
-- bodies ship empty and are written by the studio through an editor. Nothing
-- here invents marketing advice on her behalf.
--
-- The worksheets are the interesting part, and the reason this is not just a
-- documentation site. A SWOT worksheet is a form whose answers are *about the
-- business*, and those answers land in `business_profile` — which is what makes
-- "learn the individual account and understand the business" possible. Every
-- other module can then read a real positioning statement and target client
-- instead of guessing.

set lock_timeout = '10s';

-- ---------------------------------------------------------------------------
-- course structure
-- ---------------------------------------------------------------------------

create table public.academy_modules (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  summary      text,

  -- lucide-react icon name, so a module looks like something in a list.
  icon         text,
  accent_color text check (accent_color is null or accent_color ~ '^#[0-9a-fA-F]{6}$'),

  sort_order   integer not null default 0,
  -- Draft by default, so a half-written module is not visible to the studio.
  is_published boolean not null default false,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index academy_modules_order_idx
  on public.academy_modules (is_published, sort_order);

create trigger academy_modules_touch before update on public.academy_modules
  for each row execute function public.touch_updated_at();

create table public.academy_lessons (
  id           uuid primary key default gen_random_uuid(),
  module_id    uuid not null references public.academy_modules (id) on delete cascade,
  slug         text not null,
  title        text not null,
  summary      text,

  -- Markdown, authored in-app. Empty until the studio writes it.
  body_md      text not null default '',

  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  sort_order   integer not null default 0,
  is_published boolean not null default false,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index academy_lessons_slug_idx
  on public.academy_lessons (module_id, slug);
create index academy_lessons_order_idx
  on public.academy_lessons (module_id, sort_order);

create trigger academy_lessons_touch before update on public.academy_lessons
  for each row execute function public.touch_updated_at();

-- Downloads and links hanging off a lesson: landing page templates, a customer
-- journey map, the Skool community. External URLs rather than a rebuild — an
-- in-app forum is a different product.
create table public.academy_resources (
  id           uuid primary key default gen_random_uuid(),
  lesson_id    uuid references public.academy_lessons (id) on delete cascade,
  module_id    uuid references public.academy_modules (id) on delete cascade,

  title        text not null,
  description  text,
  kind         text not null default 'link'
                 check (kind in ('template', 'checklist', 'link', 'download',
                                 'video', 'community')),
  url          text,
  storage_path text,

  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),

  -- Belongs to one or the other, never both and never neither.
  constraint academy_resources_owner_chk
    check (num_nonnulls(lesson_id, module_id) = 1)
);

create index academy_resources_lesson_idx on public.academy_resources (lesson_id, sort_order);
create index academy_resources_module_idx on public.academy_resources (module_id, sort_order);

-- ---------------------------------------------------------------------------
-- progress
-- ---------------------------------------------------------------------------

-- Per user, not per workspace: two photographers in one studio work through this
-- separately.
create table public.academy_progress (
  lesson_id    uuid not null references public.academy_lessons (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,

  status       text not null default 'in_progress'
                 check (status in ('in_progress', 'complete')),
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),

  primary key (lesson_id, user_id)
);

create index academy_progress_user_idx on public.academy_progress (user_id);

create trigger academy_progress_touch before update on public.academy_progress
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- worksheets
-- ---------------------------------------------------------------------------

create table public.academy_worksheets (
  id         uuid primary key default gen_random_uuid(),
  lesson_id  uuid not null references public.academy_lessons (id) on delete cascade,
  slug       text not null,
  title      text not null,
  intro      text,

  -- Field definitions: [{key, label, type, help, options?}]. JSON rather than
  -- a table per worksheet, because the studio adds worksheets without a migration.
  schema     jsonb not null default '[]',

  -- Which business_profile column the answers roll up into, if any. Null for
  -- worksheets that are just an exercise.
  profile_key text
                check (profile_key is null or profile_key in
                  ('swot', 'seven_ps', 'positioning', 'target_client',
                   'customer_journey', 'brand_voice', 'price_point')),

  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index academy_worksheets_slug_idx
  on public.academy_worksheets (lesson_id, slug);

create table public.academy_worksheet_responses (
  id           uuid primary key default gen_random_uuid(),
  worksheet_id uuid not null references public.academy_worksheets (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,

  -- Keyed by the field keys in the worksheet's schema.
  answers      jsonb not null default '{}',
  -- Draft answers are saved as you type; only submitted ones roll up to the
  -- business profile.
  submitted_at timestamptz,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index academy_worksheet_responses_unique_idx
  on public.academy_worksheet_responses (worksheet_id, user_id);

create trigger academy_worksheet_responses_touch before update
  on public.academy_worksheet_responses
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- what the platform knows about this business
-- ---------------------------------------------------------------------------

-- One row. The check constraint enforces that literally, because a second row
-- would silently split the platform's understanding of the business in two and
-- every reader would pick whichever it saw first.
--
-- Nothing here is Lensello-specific: this is the shape any photography business
-- would fill in, which is what keeps the platform sellable beyond one studio.
create table public.business_profile (
  id               boolean primary key default true check (id),

  business_name    text,
  positioning      text,
  target_client    text,
  price_point      text,
  unique_value     text,
  brand_voice      text,
  service_area     text,

  -- Structured worksheet output: {strengths:[], weaknesses:[], opportunities:[], threats:[]}
  swot             jsonb,
  -- {product, price, place, promotion, people, process, physical_evidence}
  seven_ps         jsonb,
  -- Ordered stages with the touchpoints at each.
  customer_journey jsonb,

  updated_by       uuid references public.profiles (id) on delete set null,
  updated_at       timestamptz not null default now()
);

insert into public.business_profile (id) values (true);

create trigger business_profile_touch before update on public.business_profile
  for each row execute function public.touch_updated_at();

comment on table public.business_profile is
  'Single row. What the platform knows about the studio, filled in by academy worksheets.';

-- ---------------------------------------------------------------------------
-- row level security
-- ---------------------------------------------------------------------------

alter table public.academy_modules              enable row level security;
alter table public.academy_lessons              enable row level security;
alter table public.academy_resources            enable row level security;
alter table public.academy_progress             enable row level security;
alter table public.academy_worksheets           enable row level security;
alter table public.academy_worksheet_responses  enable row level security;
alter table public.business_profile             enable row level security;

create policy academy_modules_staff_all on public.academy_modules
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy academy_lessons_staff_all on public.academy_lessons
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy academy_resources_staff_all on public.academy_resources
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Progress and worksheet answers are personal. Staff see their own rows only —
-- a colleague's half-finished SWOT is not the whole team's business.
create policy academy_progress_own on public.academy_progress
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy academy_worksheets_staff_all on public.academy_worksheets
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy academy_worksheet_responses_own on public.academy_worksheet_responses
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The profile itself is shared: it describes the business, not a person.
create policy business_profile_staff_all on public.business_profile
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
