import { describe, expect, it } from 'vitest';
import { hasCycle, isTooDeep, MAX_CHAIN_DEPTH } from './loop-guard';

describe('hasCycle', () => {
  it('is false for a fresh chain', () => {
    expect(hasCycle([], 'a')).toBe(false);
  });

  it('is false when the automation has not appeared yet', () => {
    expect(hasCycle(['a', 'b'], 'c')).toBe(false);
  });

  it('is true the moment an automation reappears — on the first repeat, not the second', () => {
    expect(hasCycle(['a', 'b'], 'a')).toBe(true);
  });
});

describe('isTooDeep', () => {
  it('allows a chain shorter than the limit', () => {
    expect(isTooDeep(Array.from({ length: MAX_CHAIN_DEPTH - 1 }, (_, i) => `a${i}`))).toBe(false);
  });

  it('refuses a chain at or beyond the limit, even with no repeated id', () => {
    const chain = Array.from({ length: MAX_CHAIN_DEPTH }, (_, i) => `a${i}`);
    expect(isTooDeep(chain)).toBe(true);
  });
});
