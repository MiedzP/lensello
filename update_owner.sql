UPDATE public.profiles
SET role = 'owner'
WHERE id = (
  SELECT id FROM auth.users
  WHERE email = 'michael.pagano@xerensys.ai'
);
