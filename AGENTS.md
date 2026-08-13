<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `apps/web/node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.

<!-- END:nextjs-agent-rules -->

# Lensello

An all-in-one operations platform for Lensello, a photography company. Five modules:

| Module        | Route            | Purpose                                                      |
| ------------- | ---------------- | ------------------------------------------------------------ |
| Library       | `/library`       | Shoot + photo asset management, selects, tagging             |
| Campaigns     | `/campaigns`     | Campaigns, seasonal playbooks, briefs and checklists         |
| Calendar      | `/calendar`      | Everything dated: shoots, scheduled posts, campaign tasks    |
| Conversations | `/conversations` | One inbox across email, DMs, SMS and comments                |
| Clients       | `/clients`       | Client records, consent, CRM                                 |
| Studio        | `/studio`        | Plain-English briefs → photo shortlists and generated artwork |
| Gigs          | `/gigs`          | Booking calendar, shoot logistics, deposits                  |
| Store         | `/store`         | Print catalogue, orders, lab fulfilment                      |
| Ads           | `/ads`           | Ad creative variants, spend tracking, performance            |
| Automations   | `/automations`   | Trigger/step workflows and API keys                          |
| Academy       | `/academy`       | Marketing training, worksheets, business profile             |
| Portal        | `/portal`        | Client-facing sign-in, galleries and buying                  |

Single-tenant: one Lensello workspace. Do **not** add org/workspace scoping.

**But keep it sellable.** The platform is intended for photography businesses in
general, not just this studio. Never hardcode the studio's name, branding,
prices, or UK-only assumptions into schema, seed content or templates — put them
in `business_profile`, settings, or the catalogue. Currency is configurable and
defaults to GBP; do not assume it.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase (Postgres + Auth + Storage) · npm workspaces.

- `apps/web` — the Next.js app
- `packages/core` — `@lensello/core`: shared domain types, integration adapters, AI prompts
- `supabase/migrations` — schema as plain SQL

## Next.js 16 conventions — these bite

Verified against the bundled docs. Do not write these the old way:

- **Async request APIs.** `cookies()`, `headers()`, `params`, and `searchParams` are all Promises. Always `await` them. Synchronous access was removed in 16.
  ```ts
  export default async function Page(props: PageProps<'/library/[shootId]'>) {
    const { shootId } = await props.params
  }
  ```
- **Typed route props.** Use the generated `PageProps<'/route'>` / `LayoutProps<'/route'>` global helpers rather than hand-writing prop types. Run `npx next typegen` in `apps/web` if they go stale.
- **`proxy.ts`, not `middleware.ts`.** The file is `apps/web/src/proxy.ts` and exports a function named `proxy`. Node.js runtime only — the `edge` runtime is not supported there.
- **`revalidateTag` takes two arguments:** `revalidateTag('shoots', 'max')`. The one-arg form is a TypeScript error.
- **Prefer `updateTag(tag)` in Server Actions** when the user must immediately see their own write (read-your-writes). Use `revalidateTag` only when brief staleness is fine. `refresh()` refreshes the client router but does *not* revalidate tagged data.
- **`cacheLife` / `cacheTag`** are stable — import from `next/cache` with no `unstable_` prefix.
- **Turbopack is the default.** No `--turbopack` flag. Don't add a webpack config.
- **`next lint` is gone.** Lint with `eslint` directly (`npm run lint`).
- **Images:** `images.remotePatterns` only (`domains` is deprecated); allowed `qualities` defaults to `[75]`.
- Parallel route slots require an explicit `default.tsx` or the build fails.

## Security: every Server Action authenticates

Server Actions are reachable by direct POST, not just through your UI. **Every** action must start by resolving the user and must scope its query to that user's permissions:

```ts
'use server'
import { requireUser } from '@/lib/auth'

export async function archiveShoot(formData: FormData) {
  const { user, supabase } = await requireUser()
  // ...query through `supabase`, which carries the user's RLS context
}
```

`requireUser()` throws if unauthenticated. Never use the service-role key inside a Server Action or route handler — it bypasses RLS. RLS policies are the real enforcement boundary; treat the app layer as convenience.

## Data access

- Server Components and Server Actions: `createClient()` from `@/lib/supabase/server`.
- Client Components: `createClient()` from `@/lib/supabase/client`.
- Table row types come from `@/lib/db.types` (`Tables<'shoots'>`). Domain types that cross module boundaries live in `@lensello/core`.
- Every table has RLS enabled. If you add a table, add its policies in the same migration.

## Integrations are adapters, never direct API calls

Instagram, Meta Ads, Gmail, Calendar, and Stripe are **only** reached through the adapter interfaces in `@lensello/core/integrations`. In `mock` mode (the default, and the only mode wired up today) they return realistic fixture data.

Never `fetch()` a third-party API from a module. If you need a capability the interface doesn't expose, extend the interface and its mock in `packages/core` — and say so in your final report, since that file is shared.

## UI conventions

- Compose from `@/components/ui` (`Button`, `Card`, `Input`, `Textarea`, `Select`, `Badge`, `PageHeader`, `EmptyState`, `Skeleton`). Don't introduce another component library, and don't restyle the primitives.
- Tailwind v4 with CSS-variable design tokens defined in `src/app/globals.css`. Use semantic classes (`bg-surface`, `text-muted`, `border-subtle`, `bg-accent`) rather than raw palette values like `bg-gray-100`, so light and dark both work.
- Every list view needs a real empty state. Every async boundary needs `loading.tsx`.
- Server Components by default. Add `'use client'` only for actual interactivity.

## Conventions inside a module

Each module owns one folder under `src/app/(app)/<module>/` and one under `src/lib/<module>/`:

```
src/app/(app)/library/
  page.tsx          list / index view
  loading.tsx
  actions.ts        'use server' — all mutations for this module
  components/       module-private components
src/lib/library/
  queries.ts        read helpers used by Server Components
```

Keep module-private components module-private. Only promote something to `src/components/ui` if two modules genuinely need it — and flag it, because that directory is shared.

## Parallel builds: what is yours and what is frozen

Several agents work this repo at once, each in its own git worktree. The rule
that makes that merge cleanly is strict ownership.

**Yours**: the one route folder and the one lib folder named in your brief.
Create whatever you need inside them.

**Frozen — read freely, never edit.** If you need a change here, make it work
without one and *report the need in your final message*; the integrator
reconciles all such requests at merge time.

- `src/lib/db.types.ts` — hand-written, and already contains every table for
  this round of work. `npm run db:types:check` diffs it against the schema.
- `supabase/migrations/**` — your tables already exist in the migration named in
  your brief. Need another? Use **only** your pre-assigned follow-up number, so
  two agents cannot collide on a filename.
- `src/components/ui/**`, `src/app/globals.css` — the shared kit and design
  tokens.
- `src/components/nav.tsx`, `src/app/(app)/layout.tsx` — your nav entry is
  already there.
- `src/proxy.ts` — public paths for this round are already listed.
- `packages/core/src/integrations/**` — the `PrintLab` and `ImageGenerator`
  interfaces are written and mocked.
- `AGENTS.md`, `package.json`, `vercel.json`.

Before you report done, run from the repo root and make all three pass:

```
npm run typecheck && npm run lint && npm run build
```

Leave your changes **uncommitted** in your worktree. Do not merge, rebase, or
touch another agent's folders.
