/**
 * Tokens for things shared by link: galleries, contracts.
 *
 * Shared because the reasoning is identical in both places, and because two
 * copies of a security primitive is one copy too many — a fix applied to one
 * and not the other is worse than no abstraction at all.
 *
 * sha256 rather than a slow hash is correct *here specifically*: the token is
 * 32 random bytes, so there is nothing to brute force. The point of hashing is
 * that a database leak yields no working links, not that guessing is hard.
 * Anything a human chooses — a gallery password — needs scrypt instead.
 */

import { createHash, randomBytes } from 'node:crypto';

const TOKEN_BYTES = 32;

/** A new share token. Shown once and never stored in the clear. */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Salted hash of a visitor's address.
 *
 * Two uses, both of which need to recognise a visitor without identifying one:
 * "has anybody opened this gallery", and "this acceptance came from a
 * consistent source". Storing the address itself would make either a
 * visitor-tracking log nobody asked for.
 *
 * `scope` keeps the two from being cross-referenced: the same person opening a
 * gallery and signing a contract produces different hashes.
 */
export function hashVisitor(ip: string, scope: string): string {
  const salt = process.env.LENSELLO_ENCRYPTION_KEY ?? 'lensello';
  return createHash('sha256').update(`${scope}:${salt}:${ip}`).digest('hex');
}
