import { describe, expect, it } from 'vitest';
import { contractProblem } from './access';

const NOW = Date.parse('2026-09-01T12:00:00.000Z');
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

describe('contractProblem', () => {
  it('lets a sent contract with no expiry be signed', () => {
    expect(contractProblem({ status: 'sent', expires_at: null }, NOW)).toBeNull();
  });

  it('lets a sent contract be signed before its deadline', () => {
    expect(contractProblem({ status: 'sent', expires_at: iso(60_000) }, NOW)).toBeNull();
  });

  it('blocks a sent contract after its deadline', () => {
    expect(contractProblem({ status: 'sent', expires_at: iso(-1) }, NOW)).toBe('expired');
  });

  it('treats the exact expiry instant as expired', () => {
    // The boundary is the whole reason this is a function rather than an
    // inline comparison: off by one here means a contract signable a moment
    // after the deadline, or unsignable a moment before it.
    expect(contractProblem({ status: 'sent', expires_at: iso(0) }, NOW)).toBe('expired');
  });

  it('never expires a contract that was already accepted', () => {
    // Expiry is a deadline to sign by. Once signed, the deadline was met, and
    // showing "expired" on an agreement somebody already accepted would be
    // both alarming and wrong.
    expect(
      contractProblem({ status: 'accepted', expires_at: iso(-86_400_000) }, NOW),
    ).toBeNull();
  });

  it('blocks a draft, which has not been sent for signing', () => {
    expect(contractProblem({ status: 'draft', expires_at: null }, NOW)).toBe('draft');
  });

  it('blocks a withdrawn contract', () => {
    expect(contractProblem({ status: 'void', expires_at: null }, NOW)).toBe('void');
  });

  it('reports withdrawal ahead of expiry', () => {
    expect(contractProblem({ status: 'void', expires_at: iso(-1) }, NOW)).toBe('void');
  });
});
