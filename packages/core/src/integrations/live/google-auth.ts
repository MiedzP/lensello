/**
 * Shared plumbing for talking to Google as a service account.
 *
 * Every Google adapter that uses a service account (Calendar, Drive, and
 * whatever comes next) needs the exact same handshake: sign a self-signed JWT
 * bearer assertion, exchange it for an access token, cache the token until it
 * is close to expiry. Only the *scope* differs between adapters — Calendar
 * asks for `.../auth/calendar`, Drive asks for `.../auth/drive.readonly` — so
 * this module holds the handshake once and each adapter keeps its own token
 * cache (scopes are not interchangeable, so a cached Calendar token is useless
 * for a Drive call and vice versa).
 *
 * Extracted out of `google-calendar.ts`, which had this inline before Drive
 * needed the same thing. Behaviour is unchanged — see `google-calendar.test.ts`,
 * which still exercises this code path through the Calendar adapter.
 */

import { createSign } from 'node:crypto';
import { IntegrationError } from '../types';

export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** Google caps assertion lifetime at an hour. */
const TOKEN_TTL_SECONDS = 3600;

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

/**
 * A PEM key carries newlines, which environment variables generally cannot, so
 * it arrives with them escaped. Signing fails opaquely if they are left that
 * way — the error names the algorithm, not the key.
 */
export function normaliseServiceAccountKey(rawKey: string): string {
  return rawKey.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey;
}

/** Signs a self-signed JWT bearer assertion for a Google service account. */
export function signServiceAccountAssertion(input: {
  email: string;
  privateKey: string;
  scope: string;
  provider: string;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: input.email,
      scope: input.scope,
      aud: GOOGLE_TOKEN_URL,
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
    }),
  );

  let signature: string;
  try {
    const signer = createSign('RSA-SHA256');
    signer.update(`${header}.${claims}`);
    signature = signer.sign(input.privateKey, 'base64url');
  } catch {
    throw new IntegrationError(
      'The Google service account key could not be used to sign a request. ' +
        'Check the private key is the full PEM block, including the BEGIN and END lines.',
      input.provider,
    );
  }

  return `${header}.${claims}.${signature}`;
}

export interface ServiceAccountToken {
  token: string;
  /** Unix seconds. */
  expiresAt: number;
}

/** Exchanges a signed assertion for an access token. */
export async function exchangeServiceAccountAssertion(
  assertion: string,
  provider: string,
): Promise<ServiceAccountToken> {
  const now = Math.floor(Date.now() / 1000);

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });

  const body = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
    error?: string;
  };

  if (!response.ok || !body.access_token) {
    throw new IntegrationError(
      `Google refused the service account: ${body.error_description ?? body.error ?? `HTTP ${response.status}`}`,
      provider,
      response.status >= 500,
    );
  }

  return { token: body.access_token, expiresAt: now + (body.expires_in ?? TOKEN_TTL_SECONDS) };
}
