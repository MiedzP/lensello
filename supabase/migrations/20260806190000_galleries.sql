-- Client-facing galleries.
--
-- The first surface a Lensello client's own customers ever see, and the thing
-- albums, prints, and marketing image selection all depend on.
--
-- Access control is the unguessable token, not a login: asking a wedding couple
-- to create an account to look at their photographs is how galleries go unseen.
-- The token is stored hashed so a database leak does not hand over working
-- links to every private gallery — sha256 rather than a slow hash because a
-- 32-byte random token has nothing to brute force, unlike a password.

create table public.galleries (
  id              uuid primary key default gen_random_uuid(),
  shoot_id        uuid not null references public.shoots (id) on delete cascade,

  -- sha256 of the token that appears in the URL. The token itself is shown to
  -- staff exactly once, at creation, and is not recoverable afterwards.
  token_hash      text not null unique,

  title           text not null default '',
  message         text,

  -- scrypt, with the salt embedded. Null when the gallery is link-only.
  password_hash   text,

  expires_at      timestamptz,
  -- Set instead of deleting, so a revoked link stops working while the
  -- favourites and approval it collected stay on the record.
  revoked_at      timestamptz,

  allow_downloads boolean not null default true,
  download_quality text not null default 'web'
                    check (download_quality in ('web','full')),
  watermark       boolean not null default false,

  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index galleries_shoot_idx on public.galleries (shoot_id);

comment on table public.galleries is
  'Shareable client galleries. token_hash is sha256 of the URL token; the token is never stored.';

create trigger galleries_touch before update on public.galleries
  for each row execute function public.touch_updated_at();

-- --------------------------------------------------------------------------
-- what the client picked
-- --------------------------------------------------------------------------

-- Deliberately NOT `assets.is_select`. That column is the photographer's own
-- cull, and a client's favourites are a different opinion about the same
-- photographs — merging them would silently overwrite an editing decision with
-- a preference. Staff can promote favourites to selects in one action; the two
-- are kept distinguishable because they answer different questions.
--
-- Favourites are per gallery rather than per visitor: a couple sharing one link
-- are choosing together, and splitting their picks into two sets would be
-- worse than useless.
create table public.gallery_favourites (
  gallery_id  uuid not null references public.galleries (id) on delete cascade,
  asset_id    uuid not null references public.assets (id) on delete cascade,
  created_at  timestamptz not null default now(),

  primary key (gallery_id, asset_id)
);

create index gallery_favourites_gallery_idx on public.gallery_favourites (gallery_id);

-- An approval is a commitment: it is what the album gets built from and what
-- goes to the lab. Recorded once, with who said so, and it locks favouriting.
create table public.gallery_approvals (
  gallery_id    uuid primary key references public.galleries (id) on delete cascade,
  approved_at   timestamptz not null default now(),
  approved_name text not null default '',
  note          text,
  -- Count at the moment of approval, so a later change is detectable rather
  -- than silently rewriting what was agreed.
  favourite_count integer not null default 0
);

-- Activity, so the studio can see a gallery was actually opened before chasing.
create table public.gallery_views (
  id          uuid primary key default gen_random_uuid(),
  gallery_id  uuid not null references public.galleries (id) on delete cascade,
  -- Salted hash, never a raw address: this answers "has anyone looked", not
  -- "who and from where".
  ip_hash     text,
  downloaded  boolean not null default false,
  created_at  timestamptz not null default now()
);

create index gallery_views_gallery_idx on public.gallery_views (gallery_id, created_at desc);

-- --------------------------------------------------------------------------
-- row level security
-- --------------------------------------------------------------------------

-- Staff manage galleries through their session. The public gallery route has
-- no session at all and goes through the service role, because a visitor
-- holding a token is not an authenticated user and must not be granted one.
alter table public.galleries          enable row level security;
alter table public.gallery_favourites enable row level security;
alter table public.gallery_approvals  enable row level security;
alter table public.gallery_views      enable row level security;

create policy galleries_staff_all on public.galleries
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy gallery_favourites_staff_all on public.gallery_favourites
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy gallery_approvals_staff_all on public.gallery_approvals
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy gallery_views_staff_select on public.gallery_views
  for select to authenticated using (public.is_staff());
