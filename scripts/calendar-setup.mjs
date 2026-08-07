/**
 * Wire up Google Calendar from a downloaded service-account key, and prove it
 * works before trusting it with a booking.
 *
 *   npm run calendar:setup -- <path-to-key.json> [calendar-id]
 *
 * Why a script rather than "paste three values into .env": every way this is
 * set up wrong fails at a different layer, and Google's own errors name none of
 * them. The API not enabled, the calendar never shared, shared read-only, the
 * PEM mangled on the way into an environment variable — all of these surface
 * later as a booking that silently never appeared on anybody's diary. Each one
 * is checked here, by doing the thing, and named in the terms of the fix.
 *
 * The last check writes a real event and deletes it. Read access is not what
 * the application needs, and "See all event details" is one line above "Make
 * changes to events" in Google's sharing menu.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { resolve } from 'node:path';

const ENV_PATH = resolve('apps/web/.env.local');
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const SCOPE = 'https://www.googleapis.com/auth/calendar';

const ok = (message) => console.log(`  \x1b[32mok\x1b[0m    ${message}`);
const bad = (message) => console.log(`  \x1b[31mfail\x1b[0m  ${message}`);
const note = (message) => console.log(`        ${message}`);

const USAGE = `
Usage: npm run calendar:setup -- <path-to-key.json> [calendar-id]

Get the key file:
  1. console.cloud.google.com -> pick or create a project
  2. APIs & Services -> Library -> "Google Calendar API" -> Enable
  3. APIs & Services -> Credentials -> Create credentials -> Service account
     (skip the optional role and user-access steps)
  4. Open the service account -> Keys -> Add key -> Create new key -> JSON

Then share the calendar with it:
  5. Google Calendar -> the studio calendar -> Settings and sharing
     -> Share with specific people -> add the service account address
     -> permission "Make changes to events"
  6. Same page, "Integrate calendar" -> copy the Calendar ID

Then run this with the downloaded file. It will do the rest.
`;

/**
 * Explains what to do, then stops. Nothing is half-written on the way out.
 *
 * Thrown rather than `process.exit`, which aborts on Windows when a keep-alive
 * socket from an earlier `fetch` is still open — the setup failure then arrives
 * as a libuv assertion instead of the explanation it was meant to print.
 */
class SetupError extends Error {
  constructor(problem, fix) {
    super(problem);
    this.fix = fix;
  }
}

function stop(problem, ...fix) {
  throw new SetupError(problem, fix);
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

/** A service-account access token, from a self-signed JWT. */
async function accessToken(key) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );

  let assertion;
  try {
    const signer = createSign('RSA-SHA256');
    signer.update(`${header}.${claims}`);
    assertion = `${header}.${claims}.${signer.sign(key.private_key, 'base64url')}`;
  } catch {
    stop(
      'The private_key in that file could not be used to sign anything.',
      'It may have been edited. Download the key again from Google Cloud.',
    );
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });

  const body = await response.json();
  if (!response.ok || !body.access_token) {
    const detail = body.error_description ?? body.error ?? `HTTP ${response.status}`;
    stop(
      `Google refused the key: ${detail}`,
      // Both readings of invalid_grant, because the message does not say which.
      /account not found/i.test(detail)
        ? 'That service account no longer exists in Google Cloud, or the key is from a deleted one.'
        : 'The key may have been deleted, or the clock on this machine may be wrong.',
      'Create a fresh one: service account -> Keys -> Add key -> JSON.',
    );
  }
  return body.access_token;
}

function apiFor(token) {
  return async function api(path, { method = 'GET', body, params } = {}) {
    const url = new URL(`${CALENDAR_API}${path}`);
    for (const [name, value] of Object.entries(params ?? {})) {
      url.searchParams.set(name, value);
    }

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    return {
      status: response.status,
      ok: response.ok,
      body: text ? JSON.parse(text) : {},
    };
  };
}

/** Replaces the value if the key is already there, appends it if not. */
function upsert(contents, name, value) {
  const line = `${name}="${value}"`;
  const pattern = new RegExp(`^${name}=.*$`, 'm');
  if (pattern.test(contents)) return contents.replace(pattern, line);
  return `${contents.replace(/\n*$/, '')}\n${line}\n`;
}

async function main() {
  const [, , keyPath, calendarArg] = process.argv;

  if (!keyPath) {
    console.log(USAGE);
    process.exitCode = 1;
    return;
  }

  // --- the key ----------------------------------------------------------

  if (!existsSync(keyPath)) {
    stop(`No file at ${keyPath}`, 'Pass the path to the JSON key downloaded from Google Cloud.');
  }

  let key;
  try {
    key = JSON.parse(readFileSync(keyPath, 'utf8'));
  } catch {
    stop(`${keyPath} is not valid JSON.`, 'Use the JSON key file, not the p12 one.');
  }

  if (key.type !== 'service_account') {
    stop(
      'That is not a service-account key.',
      key.type
        ? `The file says type "${key.type}".`
        : 'The file has no "type" field, so it is probably an OAuth client secret.',
      'Create credentials -> Service account, then Keys -> Add key -> JSON.',
    );
  }

  if (!key.client_email || !key.private_key) {
    stop('The key file is missing client_email or private_key.', 'Download it again.');
  }

  ok(`service account ${key.client_email}`);

  // --- the token --------------------------------------------------------

  const api = apiFor(await accessToken(key));
  ok('signed in as the service account');

  // --- the API ----------------------------------------------------------

  const list = await api('/users/me/calendarList');

  if (!list.ok) {
    const message = list.body?.error?.message ?? `HTTP ${list.status}`;
    // The one failure that is about the project rather than the calendar.
    if (/has not been used|is disabled|API has not been/i.test(message)) {
      const enableUrl = message.match(/https:\/\/\S+/)?.[0]?.replace(/[.)]$/, '');
      stop(
        'The Google Calendar API is not enabled on that project.',
        enableUrl
          ? `Enable it here: ${enableUrl}`
          : 'Enable "Google Calendar API" under APIs & Services -> Library.',
        'It takes a minute to take effect. Then run this again.',
      );
    }
    stop(`Google Calendar refused the request: ${message}`);
  }

  const calendars = list.body.items ?? [];
  ok(
    `the API is enabled (${calendars.length} calendar${calendars.length === 1 ? '' : 's'} shared with this account)`,
  );

  // --- which calendar ---------------------------------------------------

  let calendarId = calendarArg;

  if (!calendarId) {
    if (calendars.length === 0) {
      stop(
        'No calendar has been shared with the service account yet.',
        'In Google Calendar, open the studio calendar -> Settings and sharing',
        '-> "Share with specific people or groups" -> Add people:',
        '',
        `    ${key.client_email}`,
        '',
        'Set the permission to "Make changes to events", then run this again.',
      );
    }
    if (calendars.length > 1) {
      stop(
        'More than one calendar is shared. Re-run naming the one to use:',
        '',
        ...calendars.flatMap((entry) => [
          `    ${entry.summary ?? '(no name)'} — ${entry.accessRole}`,
          `      npm run calendar:setup -- ${keyPath} ${entry.id}`,
        ]),
      );
    }
    calendarId = calendars[0].id;
    ok(`using "${calendars[0].summary ?? calendarId}"`);
  }

  const entry = calendars.find((candidate) => candidate.id === calendarId);

  if (!entry) {
    stop(
      `The service account cannot see a calendar with id ${calendarId}.`,
      'Share that calendar with the address below, or re-check the Calendar ID',
      'under "Integrate calendar" in that calendar\'s settings.',
      '',
      `    ${key.client_email}`,
    );
  }

  // reader / freeBusyReader / writer / owner. Writing needs the last two.
  if (entry.accessRole !== 'writer' && entry.accessRole !== 'owner') {
    stop(
      `The calendar is shared read-only (${entry.accessRole}).`,
      'Confirming a gig has to create an event, so this would fail at the',
      'moment it matters. In Settings and sharing, change the permission for',
      `${key.client_email}`,
      'to "Make changes to events".',
    );
  }
  ok(`write access confirmed (${entry.accessRole})`);

  // --- prove it writes --------------------------------------------------

  const probe = await api(`/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    body: {
      summary: 'Lensello setup check — deleting itself',
      description: 'Created by scripts/calendar-setup.mjs to confirm write access.',
      start: { dateTime: '2030-01-01T10:00:00Z' },
      end: { dateTime: '2030-01-01T11:00:00Z' },
    },
  });

  if (!probe.ok) {
    stop(`Could not create a test event: ${probe.body?.error?.message ?? probe.status}`);
  }

  const cleanup = await api(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(probe.body.id)}`,
    { method: 'DELETE' },
  );

  if (!cleanup.ok && cleanup.status !== 410) {
    bad(`Created a test event but could not delete it (${cleanup.status}).`);
    note('Remove "Lensello setup check" from the calendar by hand — 1 Jan 2030.');
  } else {
    ok('created and deleted a test event');
  }

  // --- write it down ----------------------------------------------------

  // Newlines cannot survive a .env value, so they go in escaped — the adapter
  // unescapes them. This is also how Vercel hands the key back.
  const escapedKey = key.private_key.replace(/\n/g, '\\n');

  let contents = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';
  if (!contents.includes('# --- Calendar')) {
    contents = `${contents.replace(/\n*$/, '')}\n\n# --- Calendar (written by scripts/calendar-setup.mjs) ---\n`;
  }
  contents = upsert(contents, 'GOOGLE_SERVICE_ACCOUNT_EMAIL', key.client_email);
  contents = upsert(contents, 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', escapedKey);
  contents = upsert(contents, 'GOOGLE_CALENDAR_ID', calendarId);
  writeFileSync(ENV_PATH, contents);

  ok(`written to ${ENV_PATH}`);

  console.log(`
Calendar sync is live locally. Restart the dev server to pick it up.

To turn it on in production, add the same three to Vercel:

  npx vercel env add GOOGLE_SERVICE_ACCOUNT_EMAIL production
  npx vercel env add GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY production
  npx vercel env add GOOGLE_CALENDAR_ID production

Each prompts for the value. Paste them from ${ENV_PATH} — the private key as
the single line it is written as there, without the surrounding quotes. Then:

  npx vercel --prod

The amber "Calendar sync is simulated" note on a gig disappears once that
deploy is live. That note is the check: if it is still there, production did
not get the values.
`);
}

try {
  await main();
} catch (error) {
  if (!(error instanceof SetupError)) throw error;
  bad(error.message);
  for (const line of error.fix) note(line);
  console.log('');
  process.exitCode = 1;
}
