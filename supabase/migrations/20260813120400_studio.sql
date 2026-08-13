-- The creative studio: plain-English briefs over the real photo library. [agent E]
--
-- "Make it seem more human — 'I want to create a post about speeches'. Lensello
-- will search the gallery area, pull out the speeches, 10 photos of the groom's
-- speech... approve or disapprove."
--
-- Two halves. The library has to be searchable by what is *in* a photograph,
-- which today it is not — `assets` carries filenames and the photographer's
-- tags, and nobody tags 600 wedding frames by hand. So captioning writes
-- `asset_ai_labels`, and search reads them.
--
-- The other half is that nothing generated here is ever published on its own.
-- Every shortlisted photo and every generated image lands in a decision column
-- that starts at 'pending'. The studio's judgement is the product; the model is
-- a research assistant.

set lock_timeout = '10s';

-- ---------------------------------------------------------------------------
-- what is in a photograph
-- ---------------------------------------------------------------------------

create table public.asset_ai_labels (
  id          uuid primary key default gen_random_uuid(),
  asset_id    uuid not null references public.assets (id) on delete cascade,

  -- Lowercased single concept: 'speech', 'confetti', 'first dance', 'beach'.
  label       text not null,
  kind        text not null default 'subject'
                check (kind in ('subject', 'scene', 'moment', 'emotion',
                                'object', 'colour', 'people')),
  confidence  numeric(4, 3) not null default 1.0
                check (confidence >= 0 and confidence <= 1),

  -- A photographer's correction outranks the model's guess, and must not be
  -- wiped by the next captioning run. That is what this column is for.
  source      text not null default 'ai' check (source in ('ai', 'manual')),

  created_at  timestamptz not null default now()
);

create unique index asset_ai_labels_unique_idx
  on public.asset_ai_labels (asset_id, label);
-- The search query: find every asset carrying this label, best matches first.
create index asset_ai_labels_lookup_idx
  on public.asset_ai_labels (label, confidence desc);

comment on table public.asset_ai_labels is
  'What a model saw in an asset. source = manual means a human said so; never overwrite those.';

-- A single natural-language description of the whole frame, for showing the
-- photographer why a photo was picked. Separate from labels because it is prose,
-- one per asset, and regenerated wholesale.
alter table public.assets
  add column ai_caption text,
  add column ai_captioned_at timestamptz;

-- ---------------------------------------------------------------------------
-- briefs
-- ---------------------------------------------------------------------------

create table public.studio_requests (
  id            uuid primary key default gen_random_uuid(),

  -- Exactly what the photographer typed. Kept verbatim, never rewritten, so a
  -- disappointing result can be traced to the actual words used.
  prompt        text not null,
  -- The model's reading of it, shown back for confirmation before any work.
  interpreted   jsonb,

  -- Where the output is headed. Nullable: a brief can be explored before there
  -- is a campaign to attach it to.
  campaign_id   uuid references public.campaigns (id) on delete set null,
  -- Narrows the search to one shoot when the photographer already knows which.
  shoot_id      uuid references public.shoots (id) on delete set null,

  status        text not null default 'drafting'
                  check (status in ('drafting', 'searching', 'ready',
                                    'approved', 'rejected', 'failed')),
  failure_reason text,

  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index studio_requests_recent_idx
  on public.studio_requests (created_at desc);
create index studio_requests_campaign_idx
  on public.studio_requests (campaign_id) where campaign_id is not null;

create trigger studio_requests_touch before update on public.studio_requests
  for each row execute function public.touch_updated_at();

-- The photos the search proposed, in the order it proposed them.
create table public.studio_shortlist (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.studio_requests (id) on delete cascade,
  asset_id    uuid not null references public.assets (id) on delete cascade,

  rank        integer not null default 0,
  -- Why this frame. Shown in the UI, because "trust me" is not reviewable.
  rationale   text,
  score       numeric(4, 3),

  decision    text not null default 'pending'
                check (decision in ('pending', 'approved', 'rejected')),
  decided_at  timestamptz,

  created_at  timestamptz not null default now()
);

create unique index studio_shortlist_unique_idx
  on public.studio_shortlist (request_id, asset_id);
create index studio_shortlist_rank_idx
  on public.studio_shortlist (request_id, rank);

-- ---------------------------------------------------------------------------
-- generated imagery
-- ---------------------------------------------------------------------------

-- Kept apart from `assets` on purpose. `assets` is the photographer's work —
-- what was shot, culled and delivered. A generated graphic is not that, and
-- filing it there would put synthetic images in client galleries and print
-- orders. It is promoted into assets only by an explicit action.
create table public.generated_images (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid references public.studio_requests (id) on delete cascade,

  storage_path text not null,
  prompt       text not null,
  provider     text not null default 'mock',
  model        text,
  width        integer,
  height       integer,

  -- Set when the studio promotes it into the library.
  asset_id     uuid references public.assets (id) on delete set null,

  decision     text not null default 'pending'
                 check (decision in ('pending', 'approved', 'rejected')),
  decided_at   timestamptz,

  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index generated_images_request_idx
  on public.generated_images (request_id, created_at desc);

comment on table public.generated_images is
  'Synthetic imagery. Never in assets until explicitly promoted — galleries and print orders must not contain generated work.';

-- ---------------------------------------------------------------------------
-- row level security
-- ---------------------------------------------------------------------------

alter table public.asset_ai_labels   enable row level security;
alter table public.studio_requests   enable row level security;
alter table public.studio_shortlist  enable row level security;
alter table public.generated_images  enable row level security;

create policy asset_ai_labels_staff_all on public.asset_ai_labels
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy studio_requests_staff_all on public.studio_requests
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy studio_shortlist_staff_all on public.studio_shortlist
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy generated_images_staff_all on public.generated_images
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
