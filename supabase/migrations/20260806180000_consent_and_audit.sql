-- Consent, audit trail, and the schema erasure needs.
--
-- The proposal commits to UK GDPR alignment: a lawful basis for processing,
-- clear consent for marketing, data-subject access and erasure, and audit
-- trails. None of that existed. All of it is cheaper now than after a thousand
-- leads have been collected under an unrecorded basis.

-- --------------------------------------------------------------------------
-- consent
-- --------------------------------------------------------------------------

-- A history, not a flag. Consent is given and withdrawn over time, and the
-- obligation is to evidence *when* and *how* it was obtained — a boolean that
-- someone flipped last year proves nothing. `evidence` stores the exact wording
-- shown at the time, because "they ticked a box" is not a defence if nobody can
-- say what the box said.
create table public.client_consents (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  purpose     text not null check (purpose in ('marketing')),
  granted     boolean not null,
  source      text not null
                check (source in ('inquiry_form','staff','unsubscribe','import')),
  -- The exact wording the person agreed to, captured verbatim.
  evidence    text,
  -- Salted hash, never a raw address. Same reasoning as inquiry_attempts.
  ip_hash     text,
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index client_consents_client_idx
  on public.client_consents (client_id, purpose, created_at desc);

comment on table public.client_consents is
  'Consent history with evidence. Append-only; withdrawal is a new row, not an update.';

-- Denormalised current state, so a suppression check on a send is one indexed
-- column rather than a correlated subquery for the latest row per client. Kept
-- true by a trigger rather than by application code, because the one place this
-- must never drift is the check that stops marketing somebody who said no.
alter table public.clients
  add column marketing_consent boolean not null default false;

create index clients_marketing_consent_idx
  on public.clients (marketing_consent) where marketing_consent;

create or replace function public.sync_marketing_consent()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if new.purpose = 'marketing' then
    update public.clients
       set marketing_consent = new.granted
     where id = new.client_id;
  end if;
  return new;
end;
$$;

create trigger client_consents_sync
  after insert on public.client_consents
  for each row execute function public.sync_marketing_consent();

-- --------------------------------------------------------------------------
-- audit trail
-- --------------------------------------------------------------------------

-- Append-only by policy: staff may insert and read, and there is deliberately
-- no update or delete policy. An audit log the actor can edit is not one.
-- `actor_email` is denormalised on purpose — the profile it refers to may be
-- deleted later, and "who did this" must survive that.
create table public.audit_events (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid references public.profiles (id) on delete set null,
  actor_email   text,
  action        text not null check (length(trim(action)) > 0),
  subject_type  text not null,
  subject_id    text,
  -- Never the erased data itself. Enough to prove what happened, not enough to
  -- reconstruct what was deleted, which would defeat the erasure.
  detail        jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index audit_events_created_idx on public.audit_events (created_at desc);
create index audit_events_subject_idx on public.audit_events (subject_type, subject_id);

comment on table public.audit_events is
  'Append-only record of consequential actions. No update or delete policy exists.';

-- --------------------------------------------------------------------------
-- row level security
-- --------------------------------------------------------------------------

alter table public.client_consents enable row level security;
alter table public.audit_events    enable row level security;

create policy client_consents_staff_all on public.client_consents
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy audit_events_staff_select on public.audit_events
  for select to authenticated using (public.is_staff());

create policy audit_events_staff_insert on public.audit_events
  for insert to authenticated with check (public.is_staff());

-- No update or delete policy for audit_events. See the comment above.
