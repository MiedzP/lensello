import { describe, expect, it } from 'vitest';
import { inviteProblem } from './queries';

const NOW = Date.parse('2026-09-01T12:00:00.000Z');
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

const open = { revoked_at: null, expires_at: null, accepted_at: null };

/**
 * An invitation is a credential. Every one of these states failing open would
 * let somebody into the studio's whole client book, and none of them would
 * raise an error while doing it.
 */
describe('inviteProblem', () => {
  it('lets an open invitation through', () => {
    expect(inviteProblem(open, NOW)).toBeNull();
    expect(inviteProblem({ ...open, expires_at: iso(60_000) }, NOW)).toBeNull();
  });

  it('blocks a revoked invitation', () => {
    expect(inviteProblem({ ...open, revoked_at: iso(-1) }, NOW)).toBe('revoked');
  });

  it('blocks one that has already been used', () => {
    // Single use is the property that makes a forwarded link harmless once the
    // intended person has joined.
    expect(inviteProblem({ ...open, accepted_at: iso(-1) }, NOW)).toBe('used');
  });

  it('blocks an expired invitation', () => {
    expect(inviteProblem({ ...open, expires_at: iso(-1) }, NOW)).toBe('expired');
  });

  it('treats the exact expiry instant as expired', () => {
    expect(inviteProblem({ ...open, expires_at: iso(0) }, NOW)).toBe('expired');
  });

  it('reports revocation first, then use, then expiry', () => {
    // Revocation is a deliberate act and the most useful thing to surface.
    expect(
      inviteProblem({ revoked_at: iso(-1), expires_at: iso(-1), accepted_at: iso(-1) }, NOW),
    ).toBe('revoked');
    expect(
      inviteProblem({ revoked_at: null, expires_at: iso(-1), accepted_at: iso(-1) }, NOW),
    ).toBe('used');
  });
});
