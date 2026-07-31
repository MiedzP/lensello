-- Gigs module: integration provenance columns.
--
-- 0001_init.sql created `gigs` with no place to record what the gig looks like
-- in the outside world. The module needs three things it could not otherwise
-- persist:
--
--   * the calendar event id, so confirming a gig can create an event and a
--     later edit/cancel can update or delete *that* event rather than
--     orphaning it and creating a duplicate;
--   * the deposit and balance payment request ids, so "check payment status"
--     can ask the payment adapter about a specific request after a page
--     reload, rather than only within the request that created it;
--   * the hosted checkout URLs, so the photographer can copy the link and
--     send it to the client days after requesting it.
--
-- All are nullable text and all are provider-opaque — no CHECK constraints,
-- because the shape of an external id is the provider's business, not ours.
-- No new tables, so the `gigs_staff_all` policy from 0001 already covers
-- these columns; RLS needs no change.

alter table public.gigs
  add column if not exists calendar_event_id   text,
  add column if not exists deposit_payment_id  text,
  add column if not exists deposit_payment_url text,
  add column if not exists balance_payment_id  text,
  add column if not exists balance_payment_url text;

comment on column public.gigs.calendar_event_id is
  'External id from the CalendarClient adapter. Set when the gig is confirmed, cleared when cancelled.';
comment on column public.gigs.deposit_payment_id is
  'External id of the deposit request from the PaymentClient adapter.';
comment on column public.gigs.balance_payment_id is
  'External id of the balance request from the PaymentClient adapter.';

-- Reverse lookup: "which gig is this calendar event?" when reconciling a sync.
create index if not exists gigs_calendar_event_idx
  on public.gigs (calendar_event_id)
  where calendar_event_id is not null;

-- The deposit workflow reads "confirmed gigs whose deposit is still owed"
-- often enough to be worth a partial index.
create index if not exists gigs_deposit_outstanding_idx
  on public.gigs (starts_at)
  where deposit_paid_at is null and deposit_cents > 0;
