-- Client Communication Module: Feedback Requests  [agent C]
--
-- Extends the existing conversations and messages tables with a feedback
-- request system. Allows staff to request feedback on deliverables from clients
-- with configurable deadlines and tracking of responses.
--
-- This migration adds:
--  1. feedback_requests table - tracks feedback requests sent to clients
--  2. feedback_responses table - stores client feedback submissions
--  3. Relationships and indexes for efficient querying
--  4. Row-level security policies for staff access

set lock_timeout = '10s';

-- ---------------------------------------------------------------------------
-- feedback requests
-- ---------------------------------------------------------------------------

create table public.feedback_requests (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references public.conversations (id) on delete cascade,
  client_id         uuid not null references public.clients (id) on delete cascade,
  project_id        uuid references public.projects (id) on delete cascade,
  deliverable_id    text,

  subject           text not null,
  message           text,

  status            text not null default 'pending'
                      check (status in ('pending', 'submitted', 'closed')),

  deadline          timestamptz not null,
  requested_at      timestamptz not null default now(),
  responded_at      timestamptz,
  closed_at         timestamptz,

  requested_by      uuid not null references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index feedback_requests_conversation_idx
  on public.feedback_requests (conversation_id);

create index feedback_requests_client_idx
  on public.feedback_requests (client_id);

create index feedback_requests_project_idx
  on public.feedback_requests (project_id)
  where project_id is not null;

create index feedback_requests_status_deadline_idx
  on public.feedback_requests (status, deadline)
  where status in ('pending', 'submitted');

create trigger feedback_requests_touch before update on public.feedback_requests
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- feedback responses
-- ---------------------------------------------------------------------------

create table public.feedback_responses (
  id                uuid primary key default gen_random_uuid(),
  feedback_request_id uuid not null references public.feedback_requests (id) on delete cascade,
  client_id         uuid not null references public.clients (id) on delete cascade,

  feedback_text     text not null,
  rating            integer check (rating >= 1 and rating <= 5),

  submitted_at      timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index feedback_responses_request_idx
  on public.feedback_responses (feedback_request_id);

create index feedback_responses_client_idx
  on public.feedback_responses (client_id);

create index feedback_responses_submitted_idx
  on public.feedback_responses (submitted_at desc);

create trigger feedback_responses_touch before update on public.feedback_responses
  for each row execute function public.touch_updated_at();

-- Update the feedback_requests status and timestamp when a response is submitted
create or replace function public.update_feedback_request_status()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  update public.feedback_requests
     set status = 'submitted',
         responded_at = now()
   where id = new.feedback_request_id
     and status = 'pending';
  return new;
end;
$$;

create trigger feedback_responses_update_request
  after insert on public.feedback_responses
  for each row
  execute function public.update_feedback_request_status();

-- ---------------------------------------------------------------------------
-- row level security
-- ---------------------------------------------------------------------------

alter table public.feedback_requests  enable row level security;
alter table public.feedback_responses enable row level security;

create policy feedback_requests_staff_all on public.feedback_requests
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy feedback_responses_staff_all on public.feedback_responses
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
