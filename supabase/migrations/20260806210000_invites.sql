-- Per-person invite links.
--
-- `LENSELLO_SIGNUP_CODE` works, but it is a shared secret: one string that
-- everybody who has ever joined knows, that cannot be withdrawn from one person
-- without locking out everybody, and that has to be communicated separately
-- from the link. "Here is a link, and separately here is a code" is two things
-- to send and two things to leak.
--
-- An invite is one link, for one person, that stops working once used. If it
-- goes to the wrong address you revoke that one invite; the code stays whatever
-- it was for everybody else.

create table public.invites (
  id            uuid primary key default gen_random_uuid(),

  -- sha256 of the token in the URL, same reasoning as galleries and contracts:
  -- a leak of this table hands over no working invitations.
  token_hash    text not null unique,

  -- Optional. When set, the invite only works for this address — so a
  -- forwarded link cannot be redeemed by whoever it was forwarded to.
  email         text check (email is null or email = lower(trim(email))),

  -- Invites never grant 'owner'. Elevating an account stays a deliberate act
  -- in the database, not something a link can confer.
  role          text not null default 'staff' check (role = 'staff'),

  note          text,
  expires_at    timestamptz,
  revoked_at    timestamptz,

  accepted_at   timestamptz,
  accepted_by   uuid references public.profiles (id) on delete set null,

  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),

  -- An accepted invite must say who accepted it and when. Without this a bug
  -- could mark one used while leaving no trace of who joined through it.
  constraint invites_accepted_has_evidence
    check (accepted_at is null or accepted_by is not null)
);

create index invites_created_idx on public.invites (created_at desc);

comment on table public.invites is
  'Single-use joining links. token_hash is sha256 of the URL token; the token is never stored.';

alter table public.invites enable row level security;

-- Staff can see and manage invitations. Redemption happens through the service
-- role, because the person redeeming has no account yet — that is the point.
create policy invites_staff_all on public.invites
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
