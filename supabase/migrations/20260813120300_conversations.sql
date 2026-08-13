-- One inbox for every channel, and the CRM record beside it.  [agent D]
--
-- "All the conversations are held in here — SMS, Instagram, can filter it by
-- where they're coming from... you can see customer contact details in the page
-- where you message them."
--
-- Today `messages` is a flat log keyed on client_id. That is enough to list what
-- arrived and not enough to hold a conversation: an Instagram DM thread and an
-- email chain with the same person are different threads with different reply
-- mechanics, and the app has nowhere to record which is which.
--
-- Two additions. A `conversations` row groups messages into a thread on one
-- channel. `contact_identities` records that an email address, a phone number
-- and an @handle are the same person — which is what makes "store all people"
-- and cross-channel filtering possible at all.

set lock_timeout = '10s';

-- ---------------------------------------------------------------------------
-- channels
-- ---------------------------------------------------------------------------

-- SMS and WhatsApp are what she actually asked for; 'comment' covers public
-- Instagram and Facebook comments, which she wants "put into an area in
-- conversation" rather than lost on the post.
alter table public.messages
  drop constraint if exists messages_channel_check;

alter table public.messages
  add constraint messages_channel_check
  check (channel in ('email', 'form', 'instagram', 'facebook', 'tiktok',
                     'pinterest', 'sms', 'whatsapp', 'comment'));

-- ---------------------------------------------------------------------------
-- threads
-- ---------------------------------------------------------------------------

create table public.conversations (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients (id) on delete cascade,

  channel       text not null
                  check (channel in ('email', 'form', 'instagram', 'facebook',
                                     'tiktok', 'pinterest', 'sms', 'whatsapp',
                                     'comment')),

  -- The provider's own thread key: an email References root, an Instagram
  -- conversation id, a phone number. Unique per channel so an inbound webhook
  -- can find the existing thread instead of starting a new one every time.
  external_thread_id text,

  subject       text,

  status        text not null default 'open'
                  check (status in ('open', 'snoozed', 'closed')),
  snoozed_until timestamptz,

  assigned_to   uuid references public.profiles (id) on delete set null,

  -- Denormalised for the inbox list, which sorts by recency across thousands of
  -- threads and cannot afford a correlated subquery per row.
  last_message_at timestamptz,
  last_inbound_at timestamptz,
  unread_count    integer not null default 0 check (unread_count >= 0),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index conversations_external_idx
  on public.conversations (channel, external_thread_id)
  where external_thread_id is not null;

create index conversations_client_idx on public.conversations (client_id);
-- The inbox's default query: open threads, newest first, optionally by channel.
create index conversations_inbox_idx
  on public.conversations (status, last_message_at desc);
create index conversations_channel_idx
  on public.conversations (channel, last_message_at desc);

create trigger conversations_touch before update on public.conversations
  for each row execute function public.touch_updated_at();

-- Nullable, and no backfill: existing messages stay readable exactly as they
-- are, and the inbox threads them by client + channel until they are migrated.
alter table public.messages
  add column conversation_id uuid references public.conversations (id) on delete set null;

create index messages_conversation_idx
  on public.messages (conversation_id, sent_at);

-- ---------------------------------------------------------------------------
-- who a person is, across channels
-- ---------------------------------------------------------------------------

-- Generalises the existing client_social_handles table, which only knows about
-- social platforms. That table is left in place; this one is the lookup the
-- inbox uses, and is backfilled from it below.
create table public.contact_identities (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete cascade,

  channel      text not null
                 check (channel in ('email', 'phone', 'instagram', 'facebook',
                                    'tiktok', 'pinterest', 'whatsapp')),
  -- Normalised by the application: addresses lowercased, phones to E.164,
  -- handles without the leading @. Stored normalised so the unique index below
  -- actually prevents duplicates.
  identifier   text not null,

  display_name text,
  -- True once we have seen the person use it, not merely been told it.
  verified     boolean not null default false,
  is_primary   boolean not null default false,

  created_at   timestamptz not null default now()
);

-- One identifier belongs to exactly one client. Two clients claiming the same
-- inbox address is the ambiguity that makes routing silently wrong.
create unique index contact_identities_unique_idx
  on public.contact_identities (channel, identifier);

create index contact_identities_client_idx
  on public.contact_identities (client_id);

comment on table public.contact_identities is
  'Maps an address, number or handle to a client. Identifiers are stored normalised.';

-- Backfill from what is already known, so the inbox has something to match on
-- from the first request. `on conflict do nothing` because duplicates across
-- these three sources are expected, not exceptional.
insert into public.contact_identities (client_id, channel, identifier, is_primary, verified)
select id, 'email', lower(email), true, true
  from public.clients
 where email is not null and email <> ''
on conflict do nothing;

insert into public.contact_identities (client_id, channel, identifier, is_primary, verified)
select id, 'phone', regexp_replace(phone, '[^0-9+]', '', 'g'), true, false
  from public.clients
 where phone is not null and regexp_replace(phone, '[^0-9+]', '', 'g') <> ''
on conflict do nothing;

insert into public.contact_identities (client_id, channel, identifier, verified)
select client_id, platform, lower(handle), true
  from public.client_social_handles
 where handle is not null and handle <> ''
   and platform in ('instagram', 'facebook', 'tiktok', 'pinterest')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- row level security
-- ---------------------------------------------------------------------------

alter table public.conversations      enable row level security;
alter table public.contact_identities enable row level security;

create policy conversations_staff_all on public.conversations
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy contact_identities_staff_all on public.contact_identities
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
