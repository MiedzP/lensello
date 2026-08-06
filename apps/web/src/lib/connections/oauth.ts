/**
 * Shared pieces of the account-linking handshake.
 *
 * Lives outside `actions.ts` because a `'use server'` module may only export
 * async functions, and both the action that starts the flow and the route
 * handler that finishes it need the same constants.
 */

import { timingSafeEqual } from 'node:crypto';
import { headers } from 'next/headers';
import type { SocialPlatform } from '@lensello/core';

export const OAUTH_STATE_COOKIE = 'lensello_oauth_state';

/**
 * Ten minutes is long enough to read a consent screen and short enough that an
 * abandoned attempt cannot be resumed from a stale tab days later.
 */
export const OAUTH_STATE_TTL_SECONDS = 600;

/**
 * The public origin of this deployment, from the proxy headers Vercel sets.
 *
 * Derived per request rather than read from a configured base URL because the
 * redirect URI has to match the host the browser is actually on — preview
 * deployments and the production alias are different origins.
 */
export async function resolveOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host');

  if (!host) {
    throw new Error('Cannot determine the request origin: no Host header.');
  }

  // Local dev is the only http origin; everything else is behind TLS.
  const proto =
    headerList.get('x-forwarded-proto') ??
    (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');

  return `${proto}://${host}`;
}

export function callbackUrl(origin: string, platform: SocialPlatform): string {
  return `${origin}/connections/callback/${platform}`;
}

/** The cookie payload binds the state to the platform it was issued for. */
export function encodeState(platform: SocialPlatform, state: string): string {
  return `${platform}:${state}`;
}

export function decodeState(
  raw: string | undefined,
): { platform: string; state: string } | null {
  if (!raw) return null;
  const separator = raw.indexOf(':');
  if (separator <= 0) return null;
  return { platform: raw.slice(0, separator), state: raw.slice(separator + 1) };
}

/** Constant-time compare. The state is a secret for exactly one round trip. */
export function statesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
