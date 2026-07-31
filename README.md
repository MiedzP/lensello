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
cp .env.example .env.local     # then fill in the Supabase + Anthropic values
npm run dev                    # http://localhost:3000
```

### Database

There is no Supabase CLI in this environment, so apply the schema by pasting
`supabase/migrations/0001_init.sql` into the Supabase dashboard SQL editor
(Database → SQL Editor). It is idempotent-safe on a fresh project only — it
creates tables, so do not re-run it against a populated database.

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

- `apps/web/src/lib/db.types.ts` is hand-maintained against the migration.
  Once the Supabase CLI is available, replace it with
  `supabase gen types typescript` output.
- `npm audit` reports high-severity advisories in the ESLint toolchain
  (`minimatch`/`brace-expansion`) and `postcss`/`sharp` under Next. All are
  build-time dev dependencies, not runtime-reachable.
