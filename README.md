# Lensello

All-in-one operations platform for Lensello, a photography company: photo
library, AI marketing campaigns, client inbox, gig coordination, and ads.

## Layout

```
apps/web              Next.js 16 App Router application
packages/core         @lensello/core — domain types, integration adapters, AI prompts
supabase/migrations   Schema as plain SQL
AGENTS.md             Conventions. Read this before writing code.
```

## Setup

```bash
npm install
cp .env.example apps/web/.env.local   # then fill in the values
npm run dev                           # http://localhost:3000
```

**The env file must be at `apps/web/.env.local`, not the repo root.** Next.js
loads environment files from the app directory it runs in, so a root-level
`.env.local` is silently ignored — the app starts and then fails on the first
Supabase call with no obvious cause.

### Database

Migrations follow the Supabase CLI's timestamp convention and apply in
filename order:

```
20260731150000_init.sql        all tables, RLS, storage bucket   <- must be first
20260731150100_library.sql     asset indexes + tag functions
20260731150200_campaigns.sql   post constraints + indexes
20260731150300_clients.sql     email normalisation + upsert index
20260731150400_gigs.sql        calendar/payment columns
20260731150500_ads.sql         ad indexes
```

Everything after `init` is additive and order-independent among themselves, but
all depend on `init`. None is safe to re-run against a populated database.

With the CLI:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

Otherwise paste each file into the dashboard SQL editor (Database → SQL Editor)
in the order listed above.

The `clients` migration normalises existing `clients.email` values to
trimmed-lowercase before adding a unique index. If two rows differ only by
surrounding whitespace it will fail — that is the correct outcome, and those rows
need merging by hand first.

Once applied, provision yourself as staff. Sign up through the app, then run
this in the SQL editor:

```sql
insert into public.profiles (id, full_name, role)
select id, 'Your Name', 'owner' from auth.users where email = 'you@example.com';
```

A signed-in user without a `profiles` row can read nothing — RLS denies every
table. That is intentional, not a bug.

### Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Browser + server client key |
| `SUPABASE_SERVICE_ROLE_KEY` | no | Scripts and seeding only. Never used in app code — it bypasses RLS. |
| `ANTHROPIC_API_KEY` | for AI features | Campaign copy, captions, reply drafts, ad variants |
| `LENSELLO_INTEGRATION_MODE` | no | `mock` (default). `live` is not implemented yet and fails loudly. |

## Commands

```bash
npm run dev          # dev server
npm run build        # production build
npm run typecheck    # next typegen && tsc --noEmit
npm run lint         # eslint
```

## Integrations

Instagram, Meta Ads, Gmail, Calendar, and Stripe all sit behind interfaces in
`packages/core/src/integrations/types.ts`. Today only the mock adapters exist,
and they return deterministic fixture data — the product is fully demoable
without any third-party account.

Going live is deliberately gated because the lead times are long and mostly
out of our hands:

- **Instagram / Facebook publishing** needs a Meta Business account, a linked
  Instagram Business (not Creator or personal) account, and Meta App Review for
  `instagram_content_publish`. Expect weeks.
- **Meta Ads** needs `ads_management` and a Business verification.
- **Gmail** needs Google OAuth consent-screen verification for restricted
  scopes, plus a privacy policy URL.
- **Stripe** needs a completed business onboarding before live charges.

Setting `LENSELLO_INTEGRATION_MODE=live` currently throws rather than silently
falling back to mocks — a half-configured deploy must not look like it is
posting to Instagram when it isn't.

## Known gaps

Things that are genuinely absent, so nobody discovers them by surprise in front
of a client.

**Nothing publishes itself.** `scheduled` campaign posts store a
`scheduled_for` time, but no cron worker exists. Publishing is a manual action.
A scheduled post will sit there until someone presses publish.

**No AI alt text for photos.** Describing an image needs vision input, which
the shared `generateJson` helper does not accept. Alt text is manual-only.
Extending `apps/web/src/lib/ai.ts` with an image-accepting variant is the fix.

**`assets.captured_at` is never populated.** Reading EXIF needs a dependency
that wasn't added. The UI shows "Unknown" rather than inventing a date.

**Deposit settlement is simulated.** The mock payment adapter marks a request
`paid` on the second status check. That makes the flow demoable; it is not a
real payment.

**No pagination UI.** List reads are capped (60 shoots, 200 assets per shoot,
100 clients) which is fine at one studio's scale and will need revisiting if
the library grows past a few thousand photos.

**No test framework.** Several modules were verified with throwaway assertion
scripts during development, but nothing is committed as a test. Adding Vitest
is the first thing to do before this changes much.

**Signed URLs bypass the image cache.** Storage tokens change per render, so
`next/image` re-optimises each load. Fine at current scale; stable thumbnail
URLs are the fix if grids get slow.

**Per-ad metric fetching.** `AdManager.fetchMetrics` now returns rows tagged
with `externalId`, so one call can cover many ads, but the ads module still
loops one ad at a time. Harmless against the mock; worth batching before a live
adapter exists.

**`db.types.ts` stays hand-maintained, deliberately.** The Supabase generator
cannot infer union literals from CHECK constraints — it emits `status: string`
where the hand-written file has the real six-value union, so adopting the
generated output wholesale would lose type safety. It has been verified against
the live schema (11 tables, 122 columns, nullability included, zero
discrepancies). Re-verify after any schema change:

```bash
npm run db:types        # regenerate the snapshot from the live database
npm run db:types:check  # diff it against db.types.ts; non-zero on drift
```

Two modules carry local type declarations that exist only because `db.types.ts`
was frozen during parallel development, and can now be deleted:
`apps/web/src/lib/library/db.ts`, and the cast helpers in
`apps/web/src/lib/gigs/types.ts`.

**`npm audit`** reports high-severity advisories in the ESLint toolchain
(`minimatch`/`brace-expansion`) and `postcss`/`sharp` under Next. All are
build-time dev dependencies, not runtime-reachable.

## Cache invalidation

Four of the five modules use `revalidatePath` rather than `updateTag`, and
independently arrived at the same reasoning: `updateTag` needs data cached under
`'use cache'`/`cacheTag`, which needs `cacheComponents: true`, and every read
here goes through a cookie-bound Supabase client that cannot sit in a cached
scope anyway. The ads module uses `updateTag`, which is harmless but currently
inert. If cached reads are ever introduced, revisit all five together.
