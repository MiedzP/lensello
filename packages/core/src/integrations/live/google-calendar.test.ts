/**
 * The service-account handshake, checked without Google.
 *
 * This is worth testing precisely because it cannot be tested by using it: a
 * malformed assertion comes back as `invalid_grant`, which says nothing about
 * which of the claims was wrong. Here the JWT is verified against the public
 * half of a generated key pair, so a broken signature or a wrong `aud` fails
 * with the actual reason.
 */

import { generateKeyPairSync, createVerify } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createGoogleCalendarClient,
  isGoogleCalendarConfigured,
  resetGoogleCalendarToken,
} from './google-calendar';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** What the code under test sent, in the order it sent it. */
interface Call {
  url: string;
  method: string;
  body: string | undefined;
}

function stubFetch(handler: (call: Call) => { status?: number; json: unknown }): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', async (input: URL | string, init?: RequestInit) => {
    const call: Call = {
      url: String(input),
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? init.body : undefined,
    };
    calls.push(call);
    const { status = 200, json } = handler(call);
    return new Response(JSON.stringify(json), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  return calls;
}

/** Token first, then whatever the calendar call should return. */
function respondWith(calendar: { status?: number; json: unknown }) {
  return (call: Call) =>
    call.url.startsWith(TOKEN_URL)
      ? { json: { access_token: 'test-token', expires_in: 3600 } }
      : calendar;
}

function decodeJwt(assertion: string) {
  const [header, claims, signature] = assertion.split('.');
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${header}.${claims}`);

  return {
    signatureValid: verifier.verify(publicKey, Buffer.from(signature, 'base64url')),
    header: JSON.parse(Buffer.from(header, 'base64url').toString()) as Record<string, string>,
    claims: JSON.parse(Buffer.from(claims, 'base64url').toString()) as Record<
      string,
      string | number
    >,
  };
}

function assertionFrom(calls: readonly Call[]): string {
  const token = calls.find((call) => call.url.startsWith(TOKEN_URL));
  expect(token, 'no token request was made').toBeDefined();
  return new URLSearchParams(token!.body).get('assertion')!;
}

describe('Google Calendar service account', () => {
  beforeEach(() => {
    resetGoogleCalendarToken();
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', 'studio@lensello.iam.gserviceaccount.com');
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', privateKey);
    vi.stubEnv('GOOGLE_CALENDAR_ID', 'studio@group.calendar.google.com');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetGoogleCalendarToken();
  });

  it('signs an assertion Google can verify', async () => {
    const calls = stubFetch(respondWith({ json: { items: [] } }));
    await createGoogleCalendarClient().listEvents(
      '2026-08-01T00:00:00Z',
      '2026-08-31T00:00:00Z',
    );

    const { signatureValid, header, claims } = decodeJwt(assertionFrom(calls));

    expect(signatureValid).toBe(true);
    expect(header).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(claims.iss).toBe('studio@lensello.iam.gserviceaccount.com');
    expect(claims.aud).toBe(TOKEN_URL);
    expect(claims.scope).toBe('https://www.googleapis.com/auth/calendar');
    // Google rejects anything over an hour outright.
    expect(Number(claims.exp) - Number(claims.iat)).toBeLessThanOrEqual(3600);
  });

  it('accepts a key whose newlines survived as literal backslash-n', async () => {
    // How the key arrives from a `.env` file or the Vercel dashboard, and the
    // failure it causes names the signing algorithm rather than the key.
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', privateKey.replace(/\n/g, '\\n'));

    const calls = stubFetch(respondWith({ json: { items: [] } }));
    await createGoogleCalendarClient().listEvents(
      '2026-08-01T00:00:00Z',
      '2026-08-31T00:00:00Z',
    );

    expect(decodeJwt(assertionFrom(calls)).signatureValid).toBe(true);
  });

  it('mints one token for many calls', async () => {
    const calls = stubFetch(respondWith({ json: { items: [] } }));
    const client = createGoogleCalendarClient();

    await client.listEvents('2026-08-01T00:00:00Z', '2026-08-31T00:00:00Z');
    await client.listEvents('2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z');

    expect(calls.filter((call) => call.url.startsWith(TOKEN_URL))).toHaveLength(1);
  });

  it('skips all-day entries rather than inventing a start time', async () => {
    stubFetch(
      respondWith({
        json: {
          items: [
            {
              id: 'timed',
              summary: 'Wedding — Hartley',
              start: { dateTime: '2026-08-15T13:00:00Z' },
              end: { dateTime: '2026-08-15T21:00:00Z' },
              location: 'Hartley Manor',
            },
            // Somebody's holiday, sitting on the same calendar.
            { id: 'all-day', summary: 'Annual leave', start: { date: '2026-08-16' }, end: { date: '2026-08-17' } },
          ],
        },
      }),
    );

    const events = await createGoogleCalendarClient().listEvents(
      '2026-08-01T00:00:00Z',
      '2026-08-31T00:00:00Z',
    );

    expect(events).toEqual([
      {
        externalId: 'timed',
        title: 'Wedding — Hartley',
        startsAt: '2026-08-15T13:00:00Z',
        endsAt: '2026-08-15T21:00:00Z',
        location: 'Hartley Manor',
      },
    ]);
  });

  it('expands recurring bookings', async () => {
    // Without singleEvents a weekly slot returns one row and every occurrence
    // after the first looks free.
    const calls = stubFetch(respondWith({ json: { items: [] } }));
    await createGoogleCalendarClient().listEvents(
      '2026-08-01T00:00:00Z',
      '2026-08-31T00:00:00Z',
    );

    const list = calls.find((call) => call.url.includes('/events'))!;
    expect(new URL(list.url).searchParams.get('singleEvents')).toBe('true');
  });

  it('names the missed sharing step when the calendar is not found', async () => {
    stubFetch(respondWith({ status: 404, json: { error: { message: 'Not Found' } } }));

    await expect(
      createGoogleCalendarClient().listEvents('2026-08-01T00:00:00Z', '2026-08-31T00:00:00Z'),
    ).rejects.toThrow(/shared with the service account/);
  });

  it('treats an already-deleted event as deleted', async () => {
    // Somebody removed the entry in Google Calendar by hand. Cancelling the gig
    // should still succeed.
    stubFetch(respondWith({ status: 410, json: { error: { message: 'Resource has been deleted' } } }));

    await expect(
      createGoogleCalendarClient().deleteEvent('gone'),
    ).resolves.toBeUndefined();
  });

  it('does not mistake an unshared calendar for an already-deleted event', async () => {
    // A 404 on delete is also what an unshared calendar returns. Swallowing it
    // would clear the stored event id and abandon an event still on the diary.
    stubFetch(respondWith({ status: 404, json: { error: { message: 'Not Found' } } }));

    await expect(createGoogleCalendarClient().deleteEvent('evt')).rejects.toThrow(
      /shared with the service account/,
    );
  });

  it('updates with PATCH, so notes and attendees survive', async () => {
    const calls = stubFetch(respondWith({ json: { id: 'evt' } }));
    await createGoogleCalendarClient().updateEvent('evt', { title: 'Moved' });

    const update = calls.find((call) => call.url.includes('/events/evt'))!;
    expect(update.method).toBe('PATCH');
    expect(JSON.parse(update.body!)).toEqual({ summary: 'Moved' });
  });

  it('is unconfigured until all three values are set', () => {
    expect(isGoogleCalendarConfigured()).toBe(true);
    vi.stubEnv('GOOGLE_CALENDAR_ID', '');
    expect(isGoogleCalendarConfigured()).toBe(false);
  });
});
