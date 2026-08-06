/**
 * Gallery share tokens and passwords.
 *
 * Two different secrets with two different threat models, hashed accordingly:
 *
 *  - The **token** is 32 random bytes in the URL. There is nothing to brute
 *    force, so sha256 is right — fast, and a database leak still yields no
 *    working links because the token itself is never stored.
 *  - The **password** is chosen by a human, so it is low entropy and needs a
 *    slow hash. scrypt, with a per-gallery salt.
 *
 * Using one algorithm for both would be wrong in one direction or the other:
 * scrypt on every gallery page load is a waste, and sha256 on a password like
 * "smith2026" is barely a hash at all.
 */

import { scrypt as scryptCallback, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { generateToken, hashToken, hashVisitor as hashIp } from '@/lib/crypto/share-token';

// Re-exported so existing callers and tests keep one import site, while the
// primitives themselves live in one place shared with contracts.
export { generateToken, hashToken };

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const SALT_BYTES = 16;
const KEY_BYTES = 64;

/** Returns `scrypt$<salt>$<key>`, both base64url. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scrypt(password, salt, KEY_BYTES);
  return `scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;

  const salt = Buffer.from(parts[1]!, 'base64url');
  const expected = Buffer.from(parts[2]!, 'base64url');
  const actual = await scrypt(password, salt, expected.length);

  // Constant time, so a wrong password cannot be narrowed down by timing.
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/**
 * Salted hash of a visitor's address, for the activity log.
 *
 * Answers "has anyone opened this gallery", which is what a photographer
 * chasing a client actually needs. It deliberately cannot answer "who, and
 * from where".
 */
export function hashVisitor(ip: string): string {
  return hashIp(ip, 'gallery');
}

export type GalleryAccessProblem = 'not_found' | 'revoked' | 'expired';

/** Why a gallery cannot be opened, or null when it can. */
export function accessProblem(gallery: {
  revoked_at: string | null;
  expires_at: string | null;
}): GalleryAccessProblem | null {
  if (gallery.revoked_at) return 'revoked';
  if (gallery.expires_at && new Date(gallery.expires_at).getTime() <= Date.now()) {
    return 'expired';
  }
  return null;
}
