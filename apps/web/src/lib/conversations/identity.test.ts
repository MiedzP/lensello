import { describe, expect, it } from 'vitest';
import { normalizeContactIdentifier } from './identity';

/**
 * `contact_identities` has a unique index on `(channel, identifier)`
 * (20260813120300_conversations.sql) — this is the function that has to feed
 * it, on every write and every lookup, or two spellings of the same address,
 * number or handle become two rows instead of one.
 */
describe('normalizeContactIdentifier', () => {
  describe('email', () => {
    it('lower-cases and trims', () => {
      expect(normalizeContactIdentifier('email', '  Priya.Raman@Example.Invalid ')).toBe(
        'priya.raman@example.invalid',
      );
    });

    it('rejects addresses with no usable structure', () => {
      expect(normalizeContactIdentifier('email', 'not-an-email')).toBeNull();
      expect(normalizeContactIdentifier('email', 'missing@tld')).toBeNull();
      expect(normalizeContactIdentifier('email', '')).toBeNull();
      expect(normalizeContactIdentifier('email', null)).toBeNull();
      expect(normalizeContactIdentifier('email', undefined)).toBeNull();
    });
  });

  describe('phone', () => {
    it('strips punctuation and spacing down to digits and a leading +', () => {
      expect(normalizeContactIdentifier('phone', '+1 (555) 123-4567')).toBe('+15551234567');
      expect(normalizeContactIdentifier('phone', '020 7946 0958')).toBe('02079460958');
    });

    it('keeps only one leading +, wherever a stray one appeared', () => {
      expect(normalizeContactIdentifier('phone', '+44+7700+900000')).toBe('+447700900000');
    });

    it('rejects anything too short to be a real number', () => {
      expect(normalizeContactIdentifier('phone', '12')).toBeNull();
      expect(normalizeContactIdentifier('phone', '')).toBeNull();
    });
  });

  describe('whatsapp', () => {
    it('normalises as a phone number, not a handle', () => {
      expect(normalizeContactIdentifier('whatsapp', '+1 (555) 123-4567')).toBe('+15551234567');
    });
  });

  describe('handle channels', () => {
    it('strips a leading @ on every handle-based channel', () => {
      expect(normalizeContactIdentifier('instagram', '@lensello')).toBe('lensello');
      expect(normalizeContactIdentifier('facebook', '@@lensello')).toBe('lensello');
      expect(normalizeContactIdentifier('tiktok', '@lensello')).toBe('lensello');
      expect(normalizeContactIdentifier('pinterest', '@lensello')).toBe('lensello');
    });

    it('lower-cases and trims', () => {
      expect(normalizeContactIdentifier('instagram', '  Priya.And.Dev  ')).toBe('priya.and.dev');
    });

    it('rejects nothing usable', () => {
      expect(normalizeContactIdentifier('instagram', '@')).toBeNull();
      expect(normalizeContactIdentifier('instagram', '   ')).toBeNull();
    });

    it('rejects anything too long to be a real handle', () => {
      expect(normalizeContactIdentifier('instagram', 'a'.repeat(101))).toBeNull();
      expect(normalizeContactIdentifier('instagram', 'a'.repeat(100))).toBe('a'.repeat(100));
    });
  });

  it('produces a value the database CHECK constraints would accept', () => {
    const email = normalizeContactIdentifier('email', 'Someone@Example.COM')!;
    expect(email).toBe(email.toLowerCase());

    const handle = normalizeContactIdentifier('instagram', '@Studio.Name')!;
    expect(handle.startsWith('@')).toBe(false);
    expect(handle).toBe(handle.toLowerCase());
  });
});
