-- Clients module: make "match an inbound sender to a client" a single atomic
-- upsert instead of a read-then-write race.
--
-- 0001_init.sql already guarantees one client per email, but it does so with an
-- *expression* index:
--
--   create unique index clients_email_key on public.clients (lower(email)) where email is not null;
--
-- PostgREST can only build `ON CONFLICT (<column list>)`, so it cannot name an
-- expression or a partial index as the conflict arbiter. Without a plain,
-- non-partial unique index on `email` there is no way to write an idempotent
-- upsert through the API, and inbox sync degrades to select-then-insert — which
-- duplicates clients under concurrency.
--
-- So: normalise the column, pin the invariant with a CHECK, and add the plain
-- unique index the upsert can target. `clients_email_key` is left in place; it
-- is now redundant but dropping an index another module might be planning
-- around is not worth the merge risk, and ON CONFLICT resolves against the
-- inferred arbiter before any other index is touched.
--
-- Nothing here adds a table or a column, so `apps/web/src/lib/db.types.ts`
-- needs no corresponding change.

-- --------------------------------------------------------------------------
-- normalise existing emails
-- --------------------------------------------------------------------------

-- Store emails case- and whitespace-normalised, and treat a blank string as
-- "no email" rather than as an address that every other blank collides with.
--
-- NOTE: if two existing rows differ only by surrounding whitespace (e.g.
-- 'a@b.com' and ' a@b.com') this collapses them onto the same value and the
-- unique index below will refuse to build. That is the correct outcome — they
-- are the same person and need merging by hand first. `clients_email_key`
-- already rules out differences of case alone.
update public.clients
   set email = nullif(btrim(lower(email)), '')
 where email is not null
   and email is distinct from nullif(btrim(lower(email)), '');

alter table public.clients
  add constraint clients_email_normalised
  check (email is null or email = nullif(btrim(lower(email)), ''));

comment on constraint clients_email_normalised on public.clients is
  'Emails are stored lower-cased and trimmed, never blank. This is what makes the plain unique index on (email) equivalent to a case-insensitive one, so PostgREST can use it as an ON CONFLICT arbiter.';

-- --------------------------------------------------------------------------
-- the arbiter index
-- --------------------------------------------------------------------------

-- Deliberately NOT partial: Postgres can only infer a partial index as an
-- ON CONFLICT arbiter when the statement carries a matching WHERE predicate,
-- which PostgREST never emits. NULLs are distinct by default, so any number of
-- clients may still have no email at all.
create unique index clients_email_unique on public.clients (email);

comment on index public.clients_email_unique is
  'ON CONFLICT arbiter for inbox sync: upsert(onConflict: "email", ignoreDuplicates: true). Equivalent to clients_email_key given the clients_email_normalised constraint.';

-- --------------------------------------------------------------------------
-- row level security
-- --------------------------------------------------------------------------

-- No new tables, so no new policies. `clients` and `messages` keep the
-- `*_staff_all` policies created in 0001_init.sql, and RLS stays enabled on
-- both. Adding an index or a constraint does not affect policy evaluation.
