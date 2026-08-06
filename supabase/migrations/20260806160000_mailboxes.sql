-- Connected mailboxes: the studio's own email account, reached over IMAP and
-- SMTP with an app password.
--
-- This replaces the transactional-provider approach for client mail. Replies
-- now leave from the studio's real address, so they thread correctly in the
-- client's mail app and reply-to lands back in the same inbox — which is what
-- actually happens when a photographer answers an enquiry by hand.
--
-- Credentials follow the same split as social_accounts: connection metadata is
-- staff-readable, and the secret lives in its own table with RLS enabled and
-- **no policies at all**, so the service role is the only reader. The password
-- is additionally encrypted by the application before it is written, so a
-- leaked service-role key on its own does not yield a working mailbox login —
-- the encryption key is a separate secret held in the environment.

create table public.mailboxes (
  id              uuid primary key default gen_random_uuid(),
  email_address   text not null check (email_address = lower(trim(email_address))),
  display_name    text not null default '',

  imap_host       text not null,
  imap_port       integer not null default 993 check (imap_port between 1 and 65535),
  smtp_host       text not null,
  smtp_port       integer not null default 465 check (smtp_port between 1 and 65535),

  status          text not null default 'connected'
                    check (status in ('connected','failing','disabled')),
  -- Set when a send or fetch fails, cleared on the next success. Surfaced on
  -- the connections page so a mailbox that quietly stopped working is visible
  -- without reading logs.
  last_error      text,
  last_synced_at  timestamptz,

  connected_by    uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint mailboxes_address_key unique (email_address)
);

comment on table public.mailboxes is
  'Studio mailboxes reached over IMAP/SMTP. Passwords live in mailbox_secrets.';

create trigger mailboxes_touch before update on public.mailboxes
  for each row execute function public.touch_updated_at();

-- Exactly one mailbox sends outbound replies. A partial unique index rather
-- than a plain boolean: it makes "at most one primary" a database guarantee
-- instead of something application code has to remember on every write.
create table public.mailbox_roles (
  mailbox_id  uuid primary key references public.mailboxes (id) on delete cascade,
  is_primary  boolean not null default true
);

create unique index mailbox_roles_single_primary
  on public.mailbox_roles ((true)) where is_primary;

comment on index public.mailbox_roles_single_primary is
  'At most one primary mailbox. Replies need one unambiguous sender.';

create table public.mailbox_secrets (
  mailbox_id  uuid primary key references public.mailboxes (id) on delete cascade,
  -- AES-256-GCM ciphertext, base64, produced by lib/crypto/secret-box.ts.
  -- Never a plaintext password, even though this table is service-role only.
  password    text not null,
  updated_at  timestamptz not null default now()
);

comment on table public.mailbox_secrets is
  'Encrypted app passwords. RLS enabled with no policies: service role only.';

create trigger mailbox_secrets_touch before update on public.mailbox_secrets
  for each row execute function public.touch_updated_at();

-- --------------------------------------------------------------------------
-- row level security
-- --------------------------------------------------------------------------

alter table public.mailboxes       enable row level security;
alter table public.mailbox_roles   enable row level security;
alter table public.mailbox_secrets enable row level security;

create policy mailboxes_staff_all on public.mailboxes
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy mailbox_roles_staff_all on public.mailbox_roles
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- mailbox_secrets deliberately has no policy. See the header comment.
