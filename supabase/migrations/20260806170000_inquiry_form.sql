-- The public inquiry form.
--
-- A form submission is not email. Filing it as `channel = 'email'` would be a
-- small lie with real consequences: the reply router would try to answer it
-- through the mailbox using an `In-Reply-To` that never existed, and the
-- inbound sync's "newest email" watermark would be moved by something that
-- never came from the mail server.

alter table public.messages
  drop constraint if exists messages_channel_check;

alter table public.messages
  add constraint messages_channel_check
  check (channel in ('email','form','instagram','facebook','tiktok','pinterest'));

-- --------------------------------------------------------------------------
-- abuse throttling
-- --------------------------------------------------------------------------

-- The form is unauthenticated and writes to `clients`, so it is the one door
-- into this database that anybody on the internet can knock on. A honeypot
-- field stops naive bots; this stops the rest from filling the CRM with
-- rubbish faster than a human can delete it.
--
-- Addresses are stored as a salted hash, never in the clear: rate limiting
-- needs to recognise a repeat visitor, which a hash does, and does not need to
-- know who they are. That keeps a log of who visited the studio's website out
-- of the database entirely.
create table public.inquiry_attempts (
  id          uuid primary key default gen_random_uuid(),
  ip_hash     text not null,
  created_at  timestamptz not null default now()
);

create index inquiry_attempts_window_idx
  on public.inquiry_attempts (ip_hash, created_at desc);

comment on table public.inquiry_attempts is
  'Rate-limit ledger for the public form. Salted IP hashes, pruned as it is used.';

-- Service role only, like the other secret-adjacent tables: enabled with no
-- policies. Staff have no reason to read it and it should not appear in any
-- page's payload.
alter table public.inquiry_attempts enable row level security;
