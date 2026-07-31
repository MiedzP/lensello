# Deploying to Vercel

Status as of the last session: **the build is fixed and verified, but nothing
has been deployed yet.**

## Where things stand

- The Vercel build failure is resolved. Root cause was the lockfile, not the
  app code — see the commit `Fix Vercel build: regenerate lockfile with all
  platform binaries` for the full explanation.
- Verified by reproducing Vercel's environment locally: a clean clone in a
  `node:22-bookworm` container, `npm ci`, then `npm run build`. All 15 routes
  build. The same reproduction failed before the fix with the identical error
  Vercel reported, so the fix addresses the real cause.
- **Environment variables have not been set in Vercel.** This is the next
  blocker. The build itself succeeds without them, but the deployed app cannot
  reach Supabase and every request will fail at runtime.

## Resume here

### 1. Set environment variables in Vercel

Project → Settings → Environment Variables. Add for **Production, Preview, and
Development**:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://pzavguehexserzibscer.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | copy from `apps/web/.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | copy from `apps/web/.env.local` |
| `ANTHROPIC_API_KEY` | your key — omit and AI features disable themselves |
| `LENSELLO_INTEGRATION_MODE` | `mock` |

`apps/web/.env.local` is gitignored and holds the real values.

`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. No app code reads it today; it is
listed only because seeding scripts need it. If you would rather not have it in
Vercel at all, leave it out — nothing will break.

### 2. Check the project's build settings

The repo is an npm workspace monorepo. Vercel's log showed it correctly running
the `web` workspace, so the existing configuration works. If you ever recreate
the project, either of these is fine:

- **Root Directory** = repo root, build command `npm run build` (what it does
  now), or
- **Root Directory** = `apps/web`, letting Vercel auto-detect Next.js.

### 3. Redeploy

Push to `main`, or hit Redeploy in the Vercel dashboard. The commit with the
lockfile fix is already on `origin/main`.

### 4. Verify the deployment

Once it is live, check that the runtime — not just the build — works:

- `/` should redirect to `/login?next=%2F`
- `/login` should render the sign-in form
- Signing in should reach the dashboard

If the build passes but pages error, it is almost certainly a missing
environment variable from step 1.

## Supabase and Vercel are independent

The Supabase project is already fully set up and unaffected by deployment: all
six migrations applied, and a staff account provisioned. The deployed app talks
to the same database as local development. There is no separate production
database — if you want one, create a second Supabase project and point the
Vercel environment variables at it.

## If the build breaks again

Reproduce it locally rather than guessing from Vercel logs — the tail of an npm
error says nothing useful, and the real cause is further up:

```bash
git clone . /tmp/repro
docker run --rm -v /tmp/repro:/w -w /w node:22-bookworm \
  sh -c "npm ci && npm run build"
```

This catches the two failure classes a Windows machine cannot: missing Linux
native binaries, and imports whose casing does not match the real filename
(Windows is case-insensitive, Linux is not).
