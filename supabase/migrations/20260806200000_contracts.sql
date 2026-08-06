-- Contracts, accepted online.
--
-- A typed name plus a timestamp, the accepting party's address, and an
-- immutable copy of exactly what was on screen is sufficient evidence of
-- agreement for a service contract of this kind, and is a fraction of the work
-- of integrating an e-signature provider. The part that makes it hold up is
-- the immutability: what matters in a dispute is not that somebody clicked,
-- but that you can produce the precise words they clicked on.
--
-- `body` is therefore a SNAPSHOT, not a reference to a template. Editing the
-- studio's standard terms next year must not retroactively change what a
-- client agreed to last year.

create table public.contracts (
  id            uuid primary key default gen_random_uuid(),
  gig_id        uuid not null references public.gigs (id) on delete cascade,

  -- sha256 of the token in the URL, same reasoning as galleries: a leak of
  -- this table yields no working links.
  token_hash    text not null unique,

  -- The exact terms shown. Never regenerated, never edited after sending.
  body          text not null check (length(trim(body)) > 0),
  title         text not null default 'Photography agreement',

  status        text not null default 'draft'
                  check (status in ('draft','sent','accepted','void')),

  sent_at       timestamptz,
  expires_at    timestamptz,

  accepted_at   timestamptz,
  accepted_name text,
  -- Salted hash, scoped to contracts so it cannot be cross-referenced against
  -- gallery activity for the same person.
  accepted_ip_hash text,
  -- Kept because "which device and browser" is part of the evidential picture
  -- if an acceptance is ever disputed.
  accepted_user_agent text,

  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- An accepted contract must carry its evidence. Without this, a bug that set
  -- the status without the name and timestamp would produce a contract that
  -- claims agreement it cannot prove.
  constraint contracts_accepted_has_evidence
    check (
      status <> 'accepted'
      or (accepted_at is not null and length(trim(coalesce(accepted_name, ''))) > 0)
    ),
  constraint contracts_sent_has_time
    check (status = 'draft' or sent_at is not null)
);

create index contracts_gig_idx on public.contracts (gig_id, created_at desc);

comment on table public.contracts is
  'Per-gig agreements. body is an immutable snapshot of the terms as shown.';

comment on column public.contracts.body is
  'Snapshot. Editing the studio template must never alter an existing contract.';

create trigger contracts_touch before update on public.contracts
  for each row execute function public.touch_updated_at();

-- --------------------------------------------------------------------------
-- row level security
-- --------------------------------------------------------------------------

-- Staff manage contracts through their session. The public acceptance page has
-- no session and goes through the service role, scoped to one token — a client
-- signing a contract is not an authenticated user of the studio's workspace.
alter table public.contracts enable row level security;

create policy contracts_staff_all on public.contracts
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
