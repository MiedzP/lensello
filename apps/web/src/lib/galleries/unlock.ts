/**
 * Remembering that a visitor got past a gallery's password.
 *
 * The cookie holds an HMAC over the gallery id and its current password hash,
 * keyed by the deployment secret. Three properties fall out of that:
 *
 *  - It cannot be forged, so a visitor cannot mint their own unlock.
 *  - Changing the gallery's password invalidates every existing unlock, because
 *    the hash is part of what is signed. That is the correct behaviour: the
 *    reason to change a gallery password is to lock someone out.
 *  - It carries no personal data, so it is a strictly necessary cookie and
 *    needs no consent banner.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/** Long enough for a couple to come back to it over a weekend. */
export const UNLOCK_TTL_SECONDS = 60 * 60 * 24 * 7;

export function unlockCookieName(galleryId: string): string {
  return `lensello_g_${galleryId}`;
}

function secret(): string {
  const key = process.env.LENSELLO_ENCRYPTION_KEY?.trim();
  if (!key) {
    throw new Error(
      'LENSELLO_ENCRYPTION_KEY is not set, so gallery unlocks cannot be signed.',
    );
  }
  return key;
}

export function signUnlock(galleryId: string, passwordHash: string): string {
  return createHmac('sha256', secret())
    .update(`${galleryId}:${passwordHash}`)
    .digest('base64url');
}

export function verifyUnlock(
  value: string | undefined,
  galleryId: string,
  passwordHash: string,
): boolean {
  if (!value) return false;

  const expected = signUnlock(galleryId, passwordHash);
  const a = Buffer.from(value, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
