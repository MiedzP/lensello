import { describe, expect, it } from 'vitest';
import { normalizeHandle } from './queries';

/**
 * The CHECK on `client_social_handles` enforces this exact shape, and the
 * unique constraint on `(platform, handle)` is what stops a synced DM creating
 * a duplicate client every run. A change here that stops matching an existing
 * row is silent: nothing errors, you just start accumulating a second copy of
 * every client.
 */
describe('normalizeHandle', () => {
  it('strips a leading @, which platforms display but do not consider part of the handle', () => {
    expect(normalizeHandle('@lensello')).toBe('lensello');
    expect(normalizeHandle('@@lensello')).toBe('lensello');
  });

  it('lower-cases, so the same person typed two ways is one client', () => {
    expect(normalizeHandle('Priya.And.Dev')).toBe('priya.and.dev');
  });

  it('trims surrounding whitespace from a pasted handle', () => {
    expect(normalizeHandle('  @lensello  ')).toBe('lensello');
  });

  it('returns null for nothing usable', () => {
    expect(normalizeHandle('')).toBeNull();
    expect(normalizeHandle('   ')).toBeNull();
    expect(normalizeHandle('@')).toBeNull();
    expect(normalizeHandle(null)).toBeNull();
    expect(normalizeHandle(undefined)).toBeNull();
  });

  it('rejects anything too long to be a handle', () => {
    // Almost certainly a display name or a pasted URL, and a bad matching key.
    expect(normalizeHandle('a'.repeat(101))).toBeNull();
    expect(normalizeHandle('a'.repeat(100))).toBe('a'.repeat(100));
  });

  it('produces a value the database CHECK will accept', () => {
    const handle = normalizeHandle('  @Studio.Name  ');
    expect(handle).not.toBeNull();
    expect(handle).toBe(handle!.toLowerCase());
    expect(handle!.startsWith('@')).toBe(false);
    expect(handle).toBe(handle!.trim());
  });
});
