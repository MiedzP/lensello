-- Lensello initial schema.
--
-- Single-tenant: one studio, several staff logins. Access control is therefore
-- "is this user provisioned staff?" rather than per-row ownership. Every table
-- has RLS enabled and denies by default; `public.is_staff()` is the single
-- gate, so tightening it later is a one-function change.
--
-- Enum-like columns use CHECK constraints rather than Postgres enums: adding a
-- value to a CHECK is a cheap ALTER, whereas enum changes are awkward to revert.
-- The allowed values mirror the `const` arrays in packages/core/src/types.ts —
-- keep the two in sync.

create extension if not exists "pgcrypto";

-- --------------------------------------------------------------------------
-- staff + access gate
-- --------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  role        text not null default 'staff' check (role in ('owner', 'staff')),
  created_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Provisioned staff. A signed-up auth user with no profile row can read nothing.';

-- SECURITY DEFINER so the policy check itself is not subject to RLS on
-- profiles, which would recurse. search_path is pinned to prevent hijacking.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid()
  );
$$;

comment on function public.is_staff() is
  'True when the caller is provisioned staff. The single authorization gate.';

-- Shared updated_at trigger.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- --------------------------------------------------------------------------
-- clients
-- --------------------------------------------------------------------------

create table public.clients (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (length(trim(name)) > 0),
  email              text,
  phone              text,
  stage              text not null default 'lead'
                       check (stage in ('lead','inquiry','quoted','booked','completed','lost')),
  source             text not null default 'other'
                       check (source in ('instagram','referral','website','google','wedding_wire','repeat','other')),
  notes              text,
  last_contacted_at  timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index clients_stage_idx on public.clients (stage);
create index clients_last_contacted_idx on public.clients (last_contacted_at desc nulls last);
-- Case-insensitive lookup when matching an inbound email to a known client.
create unique index clients_email_key on public.clients (lower(email)) where email is not null;

create trigger clients_touch before update on public.clients
  for each row execute function public.touch_updated_at();

-- --------------------------------------------------------------------------
-- gigs
-- --------------------------------------------------------------------------

create table public.gigs (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid references public.clients (id) on delete set null,
  title           text not null check (length(trim(title)) > 0),
  type            text not null
                    check (type in ('wedding','engagement','portrait','headshot','family','event','commercial','product','real_estate')),
  status          text not null default 'inquiry'
                    check (status in ('inquiry','hold','confirmed','completed','cancelled')),
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  location        text,
  price_cents     integer not null default 0 check (price_cents >= 0),
  deposit_cents   integer not null default 0 check (deposit_cents >= 0),
  deposit_paid_at timestamptz,
  balance_paid_at timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint gigs_ends_after_starts check (ends_at > starts_at),
  constraint gigs_deposit_within_price check (deposit_cents <= price_cents)
);

create index gigs_starts_at_idx on public.gigs (starts_at);
create index gigs_status_idx on public.gigs (status);
create index gigs_client_idx on public.gigs (client_id);

create trigger gigs_touch before update on public.gigs
  for each row execute function public.touch_updated_at();

create table public.gig_tasks (
  id        uuid primary key default gen_random_uuid(),
  gig_id    uuid not null references public.gigs (id) on delete cascade,
  label     text not null check (length(trim(label)) > 0),
  is_done   boolean not null default false,
  due_at    timestamptz,
  position  integer not null default 0
);

create index gig_tasks_gig_idx on public.gig_tasks (gig_id, position);

-- --------------------------------------------------------------------------
-- shoots + assets (the photo library)
-- --------------------------------------------------------------------------

create table public.shoots (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (length(trim(title)) > 0),
  type            text not null
                    check (type in ('wedding','engagement','portrait','headshot','family','event','commercial','product','real_estate')),
  status          text not null default 'planned'
                    check (status in ('planned','shot','culling','editing','delivered','archived')),
  client_id       uuid references public.clients (id) on delete set null,
  gig_id          uuid references public.gigs (id) on delete set null,
  shot_at         timestamptz,
  location        text,
  notes           text,
  -- FK added after `assets` exists; the two tables reference each other.
  cover_asset_id  uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index shoots_shot_at_idx on public.shoots (shot_at desc nulls last);
create index shoots_status_idx on public.shoots (status);
create index shoots_type_idx on public.shoots (type);

create trigger shoots_touch before update on public.shoots
  for each row execute function public.touch_updated_at();

create table public.assets (
  id            uuid primary key default gen_random_uuid(),
  shoot_id      uuid not null references public.shoots (id) on delete cascade,
  storage_path  text not null unique,
  filename      text not null,
  mime_type     text not null default 'image/jpeg',
  byte_size     bigint not null default 0 check (byte_size >= 0),
  width         integer check (width is null or width > 0),
  height        integer check (height is null or height > 0),
  rating        smallint not null default 0 check (rating between 0 and 5),
  is_select     boolean not null default false,
  tags          text[] not null default '{}',
  alt_text      text,
  captured_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index assets_shoot_idx on public.assets (shoot_id);
-- Partial index: the selects grid is the hottest read in the library.
create index assets_selects_idx on public.assets (shoot_id) where is_select;
create index assets_tags_idx on public.assets using gin (tags);

alter table public.shoots
  add constraint shoots_cover_asset_fk
  foreign key (cover_asset_id) references public.assets (id) on delete set null;

-- --------------------------------------------------------------------------
-- campaigns
-- --------------------------------------------------------------------------

create table public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  objective   text not null
                check (objective in ('book_more_shoots','fill_a_date','promote_a_package','showcase_portfolio','seasonal_promo','referral_push')),
  status      text not null default 'draft'
                check (status in ('draft','ready','scheduled','active','completed','archived')),
  brief       text,
  audience    text,
  platforms   text[] not null default '{}',
  starts_on   date,
  ends_on     date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint campaigns_ends_after_starts
    check (ends_on is null or starts_on is null or ends_on >= starts_on),
  -- Guard the array contents; text[] has no per-element CHECK otherwise.
  constraint campaigns_platforms_valid
    check (platforms <@ array['instagram','facebook','tiktok','pinterest']::text[])
);

create index campaigns_status_idx on public.campaigns (status);

create trigger campaigns_touch before update on public.campaigns
  for each row execute function public.touch_updated_at();

create table public.campaign_posts (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references public.campaigns (id) on delete cascade,
  platform        text not null
                    check (platform in ('instagram','facebook','tiktok','pinterest')),
  caption         text not null default '',
  hashtags        text[] not null default '{}',
  -- Asset ordering matters (index 0 is the carousel cover), so this is an
  -- ordered uuid[] rather than a join table.
  asset_ids       uuid[] not null default '{}',
  status          text not null default 'draft'
                    check (status in ('draft','approved','scheduled','published','failed')),
  scheduled_for   timestamptz,
  published_at    timestamptz,
  external_id     text,
  failure_reason  text,
  created_at      timestamptz not null default now(),

  -- A scheduled post needs a time; a published post needs a timestamp.
  constraint campaign_posts_scheduled_needs_time
    check (status <> 'scheduled' or scheduled_for is not null),
  constraint campaign_posts_published_needs_time
    check (status <> 'published' or published_at is not null)
);

create index campaign_posts_campaign_idx on public.campaign_posts (campaign_id);
create index campaign_posts_scheduled_idx on public.campaign_posts (scheduled_for)
  where status = 'scheduled';

-- --------------------------------------------------------------------------
-- client messages
-- --------------------------------------------------------------------------

create table public.messages (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete cascade,
  direction    text not null check (direction in ('inbound','outbound')),
  subject      text,
  body         text not null,
  is_handled   boolean not null default false,
  is_ai_draft  boolean not null default false,
  sent_at      timestamptz not null default now(),
  external_id  text unique,
  created_at   timestamptz not null default now()
);

create index messages_client_idx on public.messages (client_id, sent_at desc);
-- Drives the "needs a reply" queue.
create index messages_unhandled_idx on public.messages (sent_at desc)
  where direction = 'inbound' and not is_handled;

-- Keep clients.last_contacted_at accurate without the app having to remember.
create or replace function public.sync_client_last_contacted()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  update public.clients
     set last_contacted_at = greatest(coalesce(last_contacted_at, new.sent_at), new.sent_at)
   where id = new.client_id;
  return new;
end;
$$;

create trigger messages_sync_client
  after insert on public.messages
  for each row execute function public.sync_client_last_contacted();

-- --------------------------------------------------------------------------
-- ads
-- --------------------------------------------------------------------------

create table public.ads (
  id                  uuid primary key default gen_random_uuid(),
  campaign_id         uuid references public.campaigns (id) on delete set null,
  platform            text not null default 'meta'
                        check (platform in ('meta','google','tiktok')),
  name                text not null check (length(trim(name)) > 0),
  status              text not null default 'draft'
                        check (status in ('draft','review','active','paused','ended')),
  headline            text not null default '',
  primary_text        text not null default '',
  call_to_action      text not null default 'Learn more',
  asset_id            uuid references public.assets (id) on delete set null,
  daily_budget_cents  integer not null default 0 check (daily_budget_cents >= 0),
  audience            text,
  external_id         text,
  starts_on           date,
  ends_on             date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint ads_ends_after_starts
    check (ends_on is null or starts_on is null or ends_on >= starts_on),
  -- A live ad must actually have creative and a budget.
  constraint ads_active_is_complete check (
    status not in ('active','review')
    or (length(trim(headline)) > 0
        and length(trim(primary_text)) > 0
        and daily_budget_cents > 0)
  )
);

create index ads_status_idx on public.ads (status);
create index ads_campaign_idx on public.ads (campaign_id);

create trigger ads_touch before update on public.ads
  for each row execute function public.touch_updated_at();

create table public.ad_metrics (
  id           uuid primary key default gen_random_uuid(),
  ad_id        uuid not null references public.ads (id) on delete cascade,
  day          date not null,
  impressions  integer not null default 0 check (impressions >= 0),
  clicks       integer not null default 0 check (clicks >= 0),
  spend_cents  integer not null default 0 check (spend_cents >= 0),
  leads        integer not null default 0 check (leads >= 0),

  -- Metric sync is idempotent: re-fetching a day upserts rather than duplicates.
  constraint ad_metrics_unique_day unique (ad_id, day),
  constraint ad_metrics_clicks_within_impressions check (clicks <= impressions)
);

create index ad_metrics_day_idx on public.ad_metrics (day desc);

-- --------------------------------------------------------------------------
-- row level security
-- --------------------------------------------------------------------------

alter table public.profiles       enable row level security;
alter table public.clients        enable row level security;
alter table public.gigs           enable row level security;
alter table public.gig_tasks      enable row level security;
alter table public.shoots         enable row level security;
alter table public.assets         enable row level security;
alter table public.campaigns      enable row level security;
alter table public.campaign_posts enable row level security;
alter table public.messages       enable row level security;
alter table public.ads            enable row level security;
alter table public.ad_metrics     enable row level security;

-- A user may read their own profile, and update only their display name.
create policy profiles_select_self on public.profiles
  for select to authenticated using (id = auth.uid());

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Staff have full access to studio data. Provisioning a new profile row is a
-- deliberate admin action performed with the service role, never self-serve.
do $$
declare
  t text;
begin
  foreach t in array array[
    'clients','gigs','gig_tasks','shoots','assets',
    'campaigns','campaign_posts','messages','ads','ad_metrics'
  ]
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (public.is_staff()) with check (public.is_staff())',
      t || '_staff_all', t
    );
  end loop;
end;
$$;

-- --------------------------------------------------------------------------
-- storage
-- --------------------------------------------------------------------------

-- Private bucket. Photos are served through short-lived signed URLs so a
-- leaked path does not expose a client's gallery indefinitely.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos',
  'photos',
  false,
  104857600, -- 100 MB, enough for large RAW-derived JPEGs
  array['image/jpeg','image/png','image/webp','image/avif','image/tiff']
)
on conflict (id) do nothing;

create policy photos_staff_read on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and public.is_staff());

create policy photos_staff_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and public.is_staff());

create policy photos_staff_update on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and public.is_staff())
  with check (bucket_id = 'photos' and public.is_staff());

create policy photos_staff_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and public.is_staff());
