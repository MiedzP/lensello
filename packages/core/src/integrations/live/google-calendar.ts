/**
 * Live calendar adapter: Google Calendar, via a service account.
 *
 * The obvious approach — OAuth against the photographer's own Google account —
 * walks into the same trap the Gmail API did: the calendar scope is
 * "sensitive", so an unverified app's refresh tokens expire after seven days,
 * and verification means a review and a security assessment. The studio would
 * be reconnecting their calendar every week, forever.
 *
 * A service account sidesteps it entirely. You create one, then **share the
 * studio calendar with its email address** exactly as you would with a
 * colleague. It authenticates as itself with a signed JWT — no consent screen,
 * no user token, nothing to expire. Access is granted and revoked from Google
 * Calendar's own sharing settings, which is also where a photographer would
 * think to look.
 *
 * The cost is that it only reaches calendars explicitly shared with it. That is
 * a feature: it cannot see the rest of somebody's Google account.
 *
 * UNVERIFIED — this has never run against Google's API. The JWT assertion flow
 * and the Calendar v3 shapes are well specified, but treat the first run as a
 * test.
 */

import { IntegrationError } from '../types';
import type { Timestamp } from '../../types';
import type { CalendarClient, CalendarEvent, PublishResult } from '../types';
import {
  exchangeServiceAccountAssertion,
  normaliseServiceAccountKey,
  signServiceAccountAssertion,
} from './google-auth';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const SCOPE = 'https://www.googleapis.com/auth/calendar';

/** Refreshed early, so a request never sets off with a token about to expire. */
const REFRESH_MARGIN_SECONDS = 60;

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim() &&
      process.env.GOOGLE_CALENDAR_ID?.trim(),
  );
}

function requireConfig(): { email: string; privateKey: string; calendarId: string } {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const calendarId = process.env.GOOGLE_CALENDAR_ID?.trim();

  if (!email || !rawKey || !calendarId) {
    throw new IntegrationError(
      'Google Calendar is not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL, ' +
        'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY and GOOGLE_CALENDAR_ID.',
      'google-calendar',
    );
  }

  const privateKey = normaliseServiceAccountKey(rawKey);

  return { email, privateKey, calendarId };
}

let cached: { token: string; expiresAt: number } | null = null;

/**
 * A service-account access token, minted from a self-signed JWT.
 *
 * Cached until shortly before expiry: every call would otherwise pay a full
 * round trip to Google's token endpoint before doing any actual work.
 */
async function accessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.expiresAt - REFRESH_MARGIN_SECONDS > now) return cached.token;

  const { email, privateKey } = requireConfig();

  const assertion = signServiceAccountAssertion({
    email,
    privateKey,
    scope: SCOPE,
    provider: 'google-calendar',
  });

  cached = await exchangeServiceAccountAssertion(assertion, 'google-calendar');
  return cached.token;
}

interface GoogleError {
  error?: { message?: string; code?: number };
}

/**
 * Carries the HTTP status, so callers can branch on what happened rather than
 * on how Google worded it. `deleteEvent` is the one that needs this: "already
 * gone" and "you cannot see this calendar" both arrive as prose.
 */
class CalendarHttpError extends IntegrationError {
  constructor(
    message: string,
    readonly status: number,
    retryable: boolean,
  ) {
    super(message, 'google-calendar', retryable);
  }
}

async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; params?: Record<string, string> } = {},
): Promise<T> {
  const token = await accessToken();
  const url = new URL(`${CALENDAR_API}${path}`);
  for (const [key, value] of Object.entries(options.params ?? {})) {
    url.searchParams.set(key, value);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (cause) {
    throw new IntegrationError(
      `Could not reach Google Calendar: ${cause instanceof Error ? cause.message : 'network error'}.`,
      'google-calendar',
      true,
    );
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as unknown) : {};

  if (!response.ok) {
    const detail = (parsed as GoogleError).error?.message ?? `HTTP ${response.status}`;
    // 404 on a calendar almost always means it was never shared with the
    // service account, which is the one setup step people miss.
    const hint =
      response.status === 404
        ? ' Check the calendar is shared with the service account address, with permission to make changes.'
        : '';
    throw new CalendarHttpError(
      `Google Calendar: ${detail}.${hint}`,
      response.status,
      response.status === 429 || response.status >= 500,
    );
  }

  return parsed as T;
}

interface GoogleEvent {
  id?: string;
  summary?: string;
  location?: string | null;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

function toEvent(raw: GoogleEvent): CalendarEvent | null {
  // All-day entries carry `date` rather than `dateTime`. A gig is a timed
  // booking, so an all-day row is somebody else's entry and is skipped rather
  // than coerced into a start time it does not have.
  const startsAt = raw.start?.dateTime;
  const endsAt = raw.end?.dateTime;
  if (!raw.id || !startsAt || !endsAt) return null;

  return {
    externalId: raw.id,
    title: raw.summary ?? '(untitled)',
    startsAt,
    endsAt,
    location: raw.location ?? null,
  };
}

function toGoogle(event: Partial<Omit<CalendarEvent, 'externalId'>>): GoogleEvent {
  const body: GoogleEvent = {};
  if (event.title !== undefined) body.summary = event.title;
  if (event.location !== undefined) body.location = event.location;
  if (event.startsAt !== undefined) body.start = { dateTime: event.startsAt };
  if (event.endsAt !== undefined) body.end = { dateTime: event.endsAt };
  return body;
}

class GoogleCalendarClient implements CalendarClient {
  readonly provider = 'google-calendar';

  async listEvents(from: Timestamp, to: Timestamp): Promise<CalendarEvent[]> {
    const { calendarId } = requireConfig();

    const page = await api<{ items?: GoogleEvent[] }>(
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        params: {
          timeMin: from,
          timeMax: to,
          // Expands recurring bookings into their occurrences; without it a
          // weekly slot returns one row and every instance after the first
          // looks free.
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: '250',
        },
      },
    );

    return (page.items ?? []).flatMap((raw) => {
      const event = toEvent(raw);
      return event ? [event] : [];
    });
  }

  async createEvent(event: Omit<CalendarEvent, 'externalId'>): Promise<PublishResult> {
    const { calendarId } = requireConfig();

    const created = await api<GoogleEvent>(
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      { method: 'POST', body: toGoogle(event) },
    );

    if (!created.id) {
      throw new IntegrationError('Google Calendar created an event with no id.', 'google-calendar');
    }

    return {
      externalId: created.id,
      url: created.htmlLink ?? null,
      publishedAt: new Date().toISOString(),
    };
  }

  async updateEvent(
    externalId: string,
    event: Partial<Omit<CalendarEvent, 'externalId'>>,
  ): Promise<void> {
    const { calendarId } = requireConfig();
    // PATCH, not PUT: a full replace would wipe anything set on the event in
    // Google Calendar itself — attendees, notes, reminders.
    await api(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(externalId)}`,
      { method: 'PATCH', body: toGoogle(event) },
    );
  }

  async deleteEvent(externalId: string): Promise<void> {
    const { calendarId } = requireConfig();
    try {
      await api(
        `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(externalId)}`,
        { method: 'DELETE' },
      );
    } catch (cause) {
      // 410 Gone is Google saying the event was already deleted, which is the
      // outcome asked for. Cancelling a gig should not fail because somebody
      // removed the entry by hand first.
      //
      // 404 is deliberately *not* swallowed: it is also what an unshared
      // calendar returns, and treating that as success would clear the stored
      // event id and quietly abandon an event still sitting on someone's diary.
      if (cause instanceof CalendarHttpError && cause.status === 410) return;
      throw cause;
    }
  }
}

/** Test seam: drops the cached access token. */
export function resetGoogleCalendarToken(): void {
  cached = null;
}

export function createGoogleCalendarClient(): CalendarClient {
  return new GoogleCalendarClient();
}
