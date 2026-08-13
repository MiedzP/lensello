-- Client portal and gallery presentation.  [agent A]
--
-- Two things the client asked for that the existing gallery does not do:
--
--   1. A *login* rather than a link. Galleries today are reachable by an
--      unguessable token and optionally a shared password. That is right for a
--      single delivery, but a couple who come back a year later for prints have
--      lost the email. A portal account keyed on their address, with a passcode,
--      lists every gallery they are entitled to.
--   2. Presentation control. "Mosaic, fine art — individual experiences." The
--      same photographs shown as a dense grid and as one-per-screen with air
--      around them are different products, and the photographer chooses.
--
-- Access is still never a Supabase auth user. A client is not staff, and giving
-- them a session would put them inside the workspace's RLS perimeter. The portal
-- route runs through the service role behind its own passcode check, exactly as
-- the gallery route already does.

set lock_timeout = '10s';

-- ---------------------------------------------------------------------------
-- presentation
-- ---------------------------------------------------------------------------

alter table public.galleries
  -- How the gallery renders. Not a theme name — each of these is a different
  -- browsing experience with its own layout, pacing and download affordances.
  add column display_style text not null default 'mosaic'
    check (display_style in ('mosaic', 'fine_art', 'film_strip', 'contact_sheet', 'story')),

  -- Optional per-gallery accent so a brand-matched delivery is possible without
  -- a full theming system. Hex, validated, because it goes into a style attribute.
  add column accent_color text
    check (accent_color is null or accent_color ~ '^#[0-9a-fA-F]{6}$'),

  add column cover_asset_id uuid references public.assets (id) on delete set null,

  -- Links the gallery to the client record so the portal can list it. Nullable:
  -- galleries created before the portal, and one-off shares, have no client.
  add column client_id uuid references public.clients (id) on delete set null;

create index galleries_client_idx on public.galleries (client_id)
  where client_id is not null;

comment on column public.galleries.display_style is
  'Browsing experience, not a colour theme. Each value is a distinct layout.';

-- ---------------------------------------------------------------------------
-- sections
-- ---------------------------------------------------------------------------

-- "Ceremony", "Speeches", "Portraits". A wedding gallery of 600 frames is
-- unnavigable as one wall, and the same grouping is what lets the studio ask for
-- "photos of the groom's speech" later without re-tagging anything by hand.
create table public.gallery_sections (
  id          uuid primary key default gen_random_uuid(),
  gallery_id  uuid not null references public.galleries (id) on delete cascade,
  title       text not null,
  -- Shown above the section in the fine-art and story styles, ignored by the
  -- denser ones.
  blurb       text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index gallery_sections_gallery_idx
  on public.gallery_sections (gallery_id, sort_order);

-- An asset may sit in more than one section (a portrait during the speeches
-- belongs to both), so this is a join table rather than a column on assets.
create table public.gallery_section_assets (
  section_id  uuid not null references public.gallery_sections (id) on delete cascade,
  asset_id    uuid not null references public.assets (id) on delete cascade,
  sort_order  integer not null default 0,

  primary key (section_id, asset_id)
);

create index gallery_section_assets_asset_idx
  on public.gallery_section_assets (asset_id);

-- ---------------------------------------------------------------------------
-- portal accounts
-- ---------------------------------------------------------------------------

-- Deliberately not `auth.users`. A client signing in here gets a signed cookie
-- scoped to their own client_id and nothing else; they never hold a Supabase
-- session, so `is_staff()` can never accidentally become true for them.
create table public.client_portal_accounts (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients (id) on delete cascade,

  -- Lowercased at write time by the application. Unique so two clients cannot
  -- both claim one address and make the lookup ambiguous.
  email         text not null unique,

  -- scrypt with an embedded salt, matching galleries.password_hash. Null until
  -- the client sets one from their invitation link.
  passcode_hash text,

  -- Single-use, sha256, for the "set or reset your passcode" email.
  setup_token_hash text,
  setup_expires_at timestamptz,

  last_seen_at  timestamptz,
  -- Set rather than deleted, so revoking access keeps the audit trail.
  revoked_at    timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index client_portal_accounts_client_idx
  on public.client_portal_accounts (client_id);

create trigger client_portal_accounts_touch before update
  on public.client_portal_accounts
  for each row execute function public.touch_updated_at();

-- Sessions are rows, not JWTs, so revoking access takes effect on the next
-- request instead of whenever a token happens to expire.
create table public.client_portal_sessions (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.client_portal_accounts (id) on delete cascade,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  ip_hash     text,
  created_at  timestamptz not null default now()
);

create index client_portal_sessions_account_idx
  on public.client_portal_sessions (account_id);

-- Failed passcode attempts, so the portal can rate-limit without a cache layer.
-- Mirrors the existing inquiry_attempts table rather than inventing a new shape.
create table public.client_portal_attempts (
  id          uuid primary key default gen_random_uuid(),
  email       text,
  ip_hash     text,
  succeeded   boolean not null default false,
  created_at  timestamptz not null default now()
);

create index client_portal_attempts_recent_idx
  on public.client_portal_attempts (created_at desc);

-- ---------------------------------------------------------------------------
-- row level security
-- ---------------------------------------------------------------------------

alter table public.gallery_sections        enable row level security;
alter table public.gallery_section_assets  enable row level security;
alter table public.client_portal_accounts  enable row level security;
alter table public.client_portal_sessions  enable row level security;
alter table public.client_portal_attempts  enable row level security;

create policy gallery_sections_staff_all on public.gallery_sections
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy gallery_section_assets_staff_all on public.gallery_section_assets
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Staff may see and manage portal accounts, but not read a passcode hash back
-- in any useful way (it is a hash). The portal itself uses the service role.
create policy client_portal_accounts_staff_all on public.client_portal_accounts
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Sessions and attempts are service-role only: no policy is deliberate. A
-- stolen staff session should not be able to enumerate live client sessions.
