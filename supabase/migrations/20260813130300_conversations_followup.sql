-- Threading, wired up at the database layer.  [agent D, follow-up]
--
-- 20260813120300_conversations.sql added the tables; this migration is what
-- keeps them accurate without touching the modules that write `messages`.
-- `fileInboundMessages` (clients module) and `syncSocialMessages` (connections
-- module) are the two write paths for inbound mail and DMs, `sendReplyAction`
-- is a third for outbound mail/DMs, and none of the three sets
-- `conversation_id` or knows `conversations` exists. Rather than edit three
-- files this module does not own, a trigger on `messages` does the threading:
-- it runs no matter which code path performed the insert, including a future
-- one nobody has written yet.
--
-- Three triggers, each doing one job:
--
--  1. `messages_assign_conversation` (before insert or update, only when
--     conversation_id is still null) finds the client+channel thread or
--     starts one. This is also the mechanism that threads a reply sent from
--     the *old* Clients inbox into the same conversation this module shows.
--  2. `messages_touch_conversation` (after insert) keeps last_message_at,
--     last_inbound_at and unread_count accurate, and reopens a closed/snoozed
--     thread when the client writes back in.
--  3. `messages_sync_contact_identity` (after insert) keeps
--     `contact_identities` current for the two identifier sources this schema
--     round can actually read — `clients.email` and `client_social_handles` —
--     since neither write path populates `contact_identities` itself.
--
-- Finally, a one-time backfill: every message that predates this migration
-- gets grouped into one conversation per client + channel, so history threads
-- exactly like everything from now on. (`lib/conversations/queries.ts` also
-- runs this same grouping defensively at read time, in case a message ever
-- slips in with no conversation_id through some path that bypasses triggers —
-- belt and braces, not the primary mechanism.)

set lock_timeout = '10s';

-- ---------------------------------------------------------------------------
-- 1. assign a thread to a message that arrived without one
-- ---------------------------------------------------------------------------

create or replace function public.assign_message_conversation()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  found_id uuid;
begin
  -- One thread per client per channel. Prefer a thread that is not closed, so
  -- a second open conversation never forks off the same channel; fall back to
  -- the most recent thread on that channel so history stays together even
  -- once every thread on it has been closed.
  select id into found_id
    from public.conversations
   where client_id = new.client_id
     and channel = new.channel
   order by (status <> 'closed') desc, last_message_at desc nulls last, created_at desc
   limit 1;

  if found_id is null then
    insert into public.conversations (client_id, channel, subject)
    values (new.client_id, new.channel, new.subject)
    returning id into found_id;
  end if;

  new.conversation_id := found_id;
  return new;
end;
$$;

comment on function public.assign_message_conversation() is
  'Threads a message with no conversation_id onto the client+channel thread, creating one if needed.';

create trigger messages_assign_conversation
  before insert or update on public.messages
  for each row
  when (new.conversation_id is null)
  execute function public.assign_message_conversation();

-- ---------------------------------------------------------------------------
-- 2. keep the denormalised thread stats accurate
-- ---------------------------------------------------------------------------

create or replace function public.touch_conversation_stats()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  -- conversation_id is guaranteed set by messages_assign_conversation, which
  -- runs before this (an after-insert trigger sees the row as it was written).
  update public.conversations
     set last_message_at = greatest(coalesce(last_message_at, new.sent_at), new.sent_at),
         last_inbound_at = case
           when new.direction = 'inbound'
             then greatest(coalesce(last_inbound_at, new.sent_at), new.sent_at)
           else last_inbound_at
         end,
         unread_count = case
           when new.direction = 'inbound' then unread_count + 1
           else unread_count
         end,
         -- A fresh inbound message is the client coming back. Leaving the
         -- thread closed or snoozed while a new message sits on it is what
         -- makes an inbox useless.
         status = case
           when new.direction = 'inbound' and status in ('closed', 'snoozed')
             then 'open'
           else status
         end,
         snoozed_until = case
           when new.direction = 'inbound' and status in ('closed', 'snoozed')
             then null
           else snoozed_until
         end
   where id = new.conversation_id;
  return new;
end;
$$;

comment on function public.touch_conversation_stats() is
  'After a message is inserted, updates its conversation''s last_message_at / last_inbound_at / unread_count, and reopens a closed or snoozed thread on new inbound.';

create trigger messages_touch_conversation
  after insert on public.messages
  for each row
  execute function public.touch_conversation_stats();

-- ---------------------------------------------------------------------------
-- 3. keep contact_identities current from the sources this round can read
-- ---------------------------------------------------------------------------

-- Neither write path for `messages` (fileInboundMessages, syncSocialMessages)
-- populates contact_identities — they predate it. This mirrors what each of
-- them already resolved (clients.email for mail, client_social_handles for a
-- DM) into the lookup table this module's inbox actually reads, so a contact
-- added after 20260813120300_conversations.sql's one-time backfill is not
-- invisible to it.
--
-- SMS and WhatsApp are deliberately not handled here: `messages` has no
-- per-row sender phone number to read one from, and no adapter populates
-- those channels yet regardless (see the module report).
create or replace function public.sync_contact_identity_from_message()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  found_email text;
  found_handle text;
begin
  if new.channel = 'email' then
    select lower(email) into found_email
      from public.clients
     where id = new.client_id
       and email is not null and email <> '';

    if found_email is not null then
      insert into public.contact_identities (client_id, channel, identifier, verified, is_primary)
      values (new.client_id, 'email', found_email, true, true)
      on conflict (channel, identifier)
      do update set client_id = excluded.client_id, verified = true;
    end if;

  elsif new.channel in ('instagram', 'facebook', 'tiktok', 'pinterest') then
    select handle into found_handle
      from public.client_social_handles
     where client_id = new.client_id
       and platform = new.channel
     limit 1;

    if found_handle is not null then
      insert into public.contact_identities (client_id, channel, identifier, verified)
      values (new.client_id, new.channel, found_handle, true)
      on conflict (channel, identifier)
      do update set client_id = excluded.client_id, verified = true;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.sync_contact_identity_from_message() is
  'Mirrors clients.email / client_social_handles into contact_identities so a sender resolved after the initial backfill is still findable.';

create trigger messages_sync_contact_identity
  after insert on public.messages
  for each row
  execute function public.sync_contact_identity_from_message();

-- ---------------------------------------------------------------------------
-- backfill: thread every message that predates these triggers
-- ---------------------------------------------------------------------------

insert into public.conversations
  (client_id, channel, last_message_at, last_inbound_at, unread_count, status)
select
  m.client_id,
  m.channel,
  max(m.sent_at),
  max(m.sent_at) filter (where m.direction = 'inbound'),
  count(*) filter (where m.direction = 'inbound' and not m.is_handled),
  'open'
from public.messages m
where m.conversation_id is null
group by m.client_id, m.channel;

update public.messages m
   set conversation_id = c.id
  from public.conversations c
 where m.conversation_id is null
   and c.client_id = m.client_id
   and c.channel = m.channel
   and c.external_thread_id is null;
