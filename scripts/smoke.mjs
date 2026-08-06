#!/usr/bin/env node
/**
 * Loads every route against a running deployment and fails on any error.
 *
 * This exists because three separate production-only failures got through in
 * one day: a build that never ran, native modules that could not be bundled,
 * and a `'use server'` file exporting an object. None of them were catchable by
 * `tsc`, `eslint`, `next build`, or a unit test — the first two because the
 * local build differs from the deployed one, the third because Next enforces
 * that rule when a request loads the module, not when it compiles.
 *
 * The common thread is that nothing exercised the running application. This
 * does, and it is deliberately dumb: ask for every page, complain about
 * anything that is not a success or an expected redirect. A page that renders
 * is not proof it works, but a page that 500s is proof it does not, and that
 * is the class of bug that kept escaping.
 *
 *   npm run smoke                        # against production
 *   npm run smoke -- http://localhost:3000
 *
 * Signs in when SMOKE_EMAIL and SMOKE_PASSWORD are set, so authenticated pages
 * are covered too; without them it checks the public routes and says so rather
 * than reporting a pass it did not earn.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] ?? 'https://lensello-web-kappa.vercel.app';

function loadEnv() {
  const env = {};
  try {
    const text = readFileSync(resolve(here, '../apps/web/.env.local'), 'utf8');
    for (const line of text.split('\n')) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match) env[match[1]] = match[2].replace(/^"|"$/g, '');
    }
  } catch {
    // Not fatal: the public routes need nothing.
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

/** Signs in and returns the cookie header Supabase's SSR client expects. */
async function signIn() {
  const email = process.env.SMOKE_EMAIL;
  const password = process.env.SMOKE_PASSWORD;
  if (!email || !password || !SUPABASE_URL || !ANON_KEY) return null;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    console.error('  sign-in failed, checking public routes only');
    return null;
  }

  const session = await response.json();
  const ref = new URL(SUPABASE_URL).hostname.split('.')[0];
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString('base64')}`;
  return `sb-${ref}-auth-token=${value}`;
}

/** One real id per dynamic route, so detail pages are covered too. */
async function realIds() {
  if (!SUPABASE_URL || !SERVICE_KEY) return {};
  const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
  const one = async (table) => {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`,
        { headers },
      );
      const rows = await response.json();
      return Array.isArray(rows) && rows[0] ? rows[0].id : null;
    } catch {
      return null;
    }
  };
  return {
    shoot: await one('shoots'),
    gig: await one('gigs'),
    client: await one('clients'),
    campaign: await one('campaigns'),
    ad: await one('ads'),
  };
}

const PUBLIC_ROUTES = ['/login', '/signup', '/inquire', '/paid'];

const AUTHED_ROUTES = [
  '/',
  '/library',
  '/gigs',
  '/gigs/new',
  '/clients',
  '/campaigns',
  '/campaigns/new',
  '/ads',
  '/ads/new',
  '/ads/creative',
  '/connections',
  '/staff',
];

/**
 * Routes that answer a token they will not recognise.
 *
 * Checked precisely because "not found" has to render rather than explode —
 * that page is what a client sees when a link is mistyped.
 */
const NOT_FOUND_ROUTES = [
  '/g/smoke-test-token-that-does-not-exist',
  '/c/smoke-test-token-that-does-not-exist',
  '/join/smoke-test-token-that-does-not-exist',
];

async function check(path, cookie) {
  try {
    const response = await fetch(`${BASE}${path}`, {
      headers: cookie ? { cookie } : {},
      redirect: 'manual',
    });
    // 3xx is fine: the auth gate redirecting is correct behaviour, not a fault.
    const ok = response.status < 400;
    return { path, status: response.status, ok };
  } catch (cause) {
    return { path, status: 0, ok: false, error: String(cause) };
  }
}

const cookie = await signIn();

console.log(`Smoke test: ${BASE}`);
console.log(cookie ? '  signed in\n' : '  anonymous (set SMOKE_EMAIL and SMOKE_PASSWORD for more)\n');

const ids = cookie ? await realIds() : {};
const detail = [
  ids.shoot && `/library/${ids.shoot}`,
  ids.gig && `/gigs/${ids.gig}`,
  ids.client && `/clients/${ids.client}`,
  ids.campaign && `/campaigns/${ids.campaign}`,
  ids.ad && `/ads/${ids.ad}`,
].filter(Boolean);

// Public routes are checked ANONYMOUSLY, the way a visitor actually arrives.
// Sending a session cookie to /login would only prove the signed-in redirect
// works, and would say nothing about the page a stranger sees.
const routes = [
  ...[...PUBLIC_ROUTES, ...NOT_FOUND_ROUTES].map((path) => ({ path, cookie: null })),
  ...(cookie ? [...AUTHED_ROUTES, ...detail].map((path) => ({ path, cookie })) : []),
];

const results = [];
// Sequential rather than parallel: a burst of cold starts produces timeouts
// that look like failures and are not.
for (const { path, cookie: jar } of routes) {
  const result = await check(path, jar);
  results.push(result);
  console.log(`  ${result.ok ? 'ok  ' : 'FAIL'} ${String(result.status).padEnd(4)} ${path}`);
}

const failed = results.filter((result) => !result.ok);

console.log();
if (failed.length > 0) {
  console.error(`${failed.length} of ${results.length} routes failed:`);
  for (const f of failed) console.error(`  ${f.status} ${f.path}${f.error ? ` — ${f.error}` : ''}`);
  process.exit(1);
}

console.log(`All ${results.length} routes healthy.`);
if (!cookie) {
  // Said out loud: a pass over four public pages is not a pass over the app.
  console.log('Note: only public routes were checked.');
}
