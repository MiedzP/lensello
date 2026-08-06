import { describe, expect, it } from 'vitest';
import {
  accessProblem,
  generateToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from './tokens';

/**
 * The token is the entire access control for a private gallery, and the expiry
 * and revocation checks are what stop a link outliving its welcome. All of it
 * fails silently if it fails at all: a gallery that stays open after
 * revocation looks exactly like one that was never revoked.
 */
describe('share tokens', () => {
  it('generates URL-safe tokens with no collisions across a sample', () => {
    const tokens = new Set(Array.from({ length: 500 }, () => generateToken()));
    expect(tokens.size).toBe(500);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('hashes deterministically, so a link resolves to the same gallery every time', () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it('gives different tokens different hashes', () => {
    expect(hashToken(generateToken())).not.toBe(hashToken(generateToken()));
  });

  it('does not leak the token in its hash', () => {
    const token = generateToken();
    expect(hashToken(token)).not.toContain(token);
  });
});

describe('gallery passwords', () => {
  it('accepts the right password', async () => {
    const stored = await hashPassword('smith-wedding-2026');
    await expect(verifyPassword('smith-wedding-2026', stored)).resolves.toBe(true);
  });

  it('rejects the wrong one', async () => {
    const stored = await hashPassword('smith-wedding-2026');
    await expect(verifyPassword('smith-wedding-2025', stored)).resolves.toBe(false);
    await expect(verifyPassword('', stored)).resolves.toBe(false);
  });

  it('salts, so the same password twice does not produce the same hash', async () => {
    // Otherwise two galleries sharing a password are visibly identical in the
    // database, and one cracked hash opens both.
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('rejects a malformed stored value rather than throwing', async () => {
    await expect(verifyPassword('anything', 'garbage')).resolves.toBe(false);
    await expect(verifyPassword('anything', 'md5$a$b')).resolves.toBe(false);
  });
});

describe('accessProblem', () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const past = new Date(Date.now() - 86_400_000).toISOString();

  it('allows a live gallery', () => {
    expect(accessProblem({ revoked_at: null, expires_at: null })).toBeNull();
    expect(accessProblem({ revoked_at: null, expires_at: future })).toBeNull();
  });

  it('blocks a revoked gallery', () => {
    expect(accessProblem({ revoked_at: past, expires_at: null })).toBe('revoked');
  });

  it('blocks an expired gallery', () => {
    expect(accessProblem({ revoked_at: null, expires_at: past })).toBe('expired');
  });

  it('reports revocation ahead of expiry when both apply', () => {
    // Revocation is a deliberate act; expiry is the clock. The deliberate one
    // is the more useful thing to tell the studio.
    expect(accessProblem({ revoked_at: past, expires_at: past })).toBe('revoked');
  });
});
