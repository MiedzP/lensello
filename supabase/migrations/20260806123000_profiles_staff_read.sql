-- Let staff read the staff roster.
--
-- 20260731150000_init.sql gave `profiles` a single SELECT policy,
-- `profiles_select_self`, which is correct for a table nothing enumerated. The
-- staff page does enumerate it, and the alternative — reading the list with the
-- service role — would move the authorization decision out of the database and
-- into application code, which is exactly what `is_staff()` exists to avoid.
--
-- Names and roles only, in the sense that this table holds nothing else.
-- Email addresses and sign-in times live in `auth.users` and still require the
-- service role, because that schema has no policy surface of its own.

create policy profiles_select_staff on public.profiles
  for select to authenticated
  using (public.is_staff());

comment on policy profiles_select_staff on public.profiles is
  'Provisioned staff may read the roster. Writes remain self-only + service role.';
