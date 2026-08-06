-- Social connections: linked accounts, their token material, and inbound social
-- messages.
--
-- Three tables and one column, following the conventions in
-- 20260731150000_init.sql: CHECK constraints rather than Postgres enums, RLS on
-- by default, `public.is_staff()` as the single gate.
--
-- The one deliberate departure is `social_account_secrets`. It has RLS enabled
-- and *no policies at all*, which denies every authenticated session and leaves
-- the service role — which bypasses RLS — as the only reader. Splitting tokens
-- out of `social_accounts` is the whole point: staff need to see that Instagram
-- is connected and when it last synced, and none of them need the bearer token
-- that would let a leaked session post as the studio.

-- --------------------------------------------------------------------------
-- linked accounts
-- --------------------------------------------------------------------------

create table public.social_accounts (
  id                    uuid primary key default gen_random_uuid(),
  platform              text not null
                          check (platform in ('instagram','facebook','tiktok','pinterest')),
  handle                text not null check (length(trim(handle)) > 0),
  display_name          text not null default '',
  followers             integer not null default 0 check (followers >= 0),
  status                text not null default 'connected'
                          check (status in ('connected','expired','revoked')),
  -- The platform's own id for the account. Handles get renamed; ids do not, so
  -- this is what a re-link matches on to avoid orphaning history.
  external_account_id   text,
  -- Capabilities are recorded per connection rather than assumed per platform,
  -- because they are granted per OAuth scope. A token that can post but was
  -- never granted messaging scope must not make the UI promise an inbox.
  can_publish           boolean not null default false,
  can_collect_messages  boolean not null default false,
  connected_by          uuid references public.profiles (id) on delete set null,
  connected_at          timestamptz not null default now(),
  last_synced_at        timestamptz,
  -- Last failure from this connection, cleared on the next success. Surfaced on
  -- the connections page so a silently dead token is visible without log diving.
  last_error            text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- One account per platform. `campaign_posts.platform` is the only routing key
  -- publishing has, so a second Instagram account would be unaddressable — the
  -- constraint makes that limitation explicit instead of letting rows
  -- accumulate that nothing can ever publish to. Widening this means giving
  -- campaign_posts an account_id.
  constraint social_accounts_one_per_platform unique (platform)
);

comment on table public.social_accounts is
  'Linked social accounts. Non-secret metadata only; tokens live in social_account_secrets.';

create trigger social_accounts_touch before update on public.social_accounts
  for each row execute function public.touch_updated_at();

create table public.social_account_secrets (
  account_id     uuid primary key
                   references public.social_accounts (id) on delete cascade,
  access_token   text not null,
  refresh_token  text,
  expires_at     timestamptz,
  scopes         text[] not null default '{}',
  updated_at     timestamptz not null default now()
);

comment on table public.social_account_secrets is
  'OAuth token material. RLS is enabled with no policies: service role only.';

create trigger social_account_secrets_touch before update on public.social_account_secrets
  for each row execute function public.touch_updated_at();

-- --------------------------------------------------------------------------
-- social identities -> clients
-- --------------------------------------------------------------------------

-- Inbound mail resolves a sender to a client through `clients.email`. A DM has
-- no email address, so it needs its own key. Handles are stored normalized
-- (trimmed, lower-cased, no leading '@') and the CHECK enforces it, exactly as
-- clients.email depends on normalization for matching to work.
create table public.client_social_handles (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  platform    text not null
                check (platform in ('instagram','facebook','tiktok','pinterest')),
  handle      text not null check (length(trim(handle)) > 0),
  created_at  timestamptz not null default now(),

  constraint client_social_handles_normalized
    check (handle = lower(handle) and handle not like '@%' and handle = trim(handle)),
  -- A plain column constraint, not an expression index: `on_conflict` in
  -- PostgREST can only target named columns, and this is the arbiter the sync
  -- upsert relies on to stay idempotent.
  constraint client_social_handles_key unique (platform, handle)
);

comment on table public.client_social_handles is
  'Maps a platform handle to a client, so inbound DMs can be filed like inbound mail.';

create index client_social_handles_client_idx
  on public.client_social_handles (client_id);

-- --------------------------------------------------------------------------
-- messages gain a channel
-- --------------------------------------------------------------------------

-- Defaulted, so every existing row is correctly labelled as mail and every
-- existing INSERT in the app keeps working untouched.
alter table public.messages
  add column channel text not null default 'email'
    check (channel in ('email','instagram','facebook','tiktok','pinterest'));

comment on column public.messages.channel is
  'Where the message arrived. messages.external_id stays globally unique across channels.';

create index messages_channel_idx on public.messages (channel, sent_at desc);

-- --------------------------------------------------------------------------
-- row level security
-- --------------------------------------------------------------------------

alter table public.social_accounts        enable row level security;
alter table public.social_account_secrets enable row level security;
alter table public.client_social_handles  enable row level security;

create policy social_accounts_staff_all on public.social_accounts
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy client_social_handles_staff_all on public.client_social_handles
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- social_account_secrets deliberately has no policy. See the header comment.
