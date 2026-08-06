import { describe, expect, it } from 'vitest';
import { inferSource, normalizeEmail } from './sync';

/**
 * `normalizeEmail` feeds the unique index on `lower(clients.email)`, which is
 * what stops an inbox sync creating a fresh client for every message from the
 * same person. `inferSource` writes CRM attribution a human then trusts.
 */
describe('normalizeEmail', () => {
  it('lower-cases and trims, so one person is one client', () => {
    expect(normalizeEmail('  Priya.Raman@Example.Invalid ')).toBe(
      'priya.raman@example.invalid',
    );
  });

  it('rejects addresses with no usable structure', () => {
    expect(normalizeEmail('')).toBeNull();
    expect(normalizeEmail('not-an-email')).toBeNull();
    expect(normalizeEmail('missing@tld')).toBeNull();
    expect(normalizeEmail('two spaces@example.com')).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });

  it('accepts odd-but-real addresses rather than losing the enquiry', () => {
    // A matching key, not a deliverability guarantee. Rejecting a real address
    // costs a booking; accepting a strange one costs nothing.
    expect(normalizeEmail('first+wedding@example.co.uk')).toBe(
      'first+wedding@example.co.uk',
    );
    expect(normalizeEmail("o'brien@example.com")).toBe("o'brien@example.com");
  });
});

describe('inferSource', () => {
  const message = (subject: string, body: string, fromEmail = 'a@example.com') => ({
    subject,
    body,
    fromEmail,
  });

  it('defaults to website when nothing is claimed', () => {
    expect(inferSource(message('Hello', 'Do you have August free?'))).toBe('website');
  });

  it('picks up an explicit referral', () => {
    expect(inferSource(message('Hi', 'Sarah referred us to you'))).toBe('referral');
  });

  it('picks up Instagram when the sender says so', () => {
    expect(inferSource(message('Hi', 'Found you on Instagram'))).toBe('instagram');
  });

  it('prefers repeat over a channel mentioned in the same message', () => {
    // A returning client who also mentions Instagram is still a repeat client;
    // attributing them to Instagram would overstate that channel.
    expect(
      inferSource(message('Hi', 'We did a session with you in 2024, found you again on Instagram')),
    ).toBe('repeat');
  });

  it('uses the sender domain for Wedding Wire', () => {
    expect(inferSource(message('Enquiry', 'Hello', 'lead@weddingwire.com'))).toBe(
      'wedding_wire',
    );
  });

  it('does not infer a source from an ordinary mail provider', () => {
    // Somebody using Gmail did not "come from Google".
    expect(inferSource(message('Hi', 'Are you free?', 'someone@gmail.com'))).toBe(
      'website',
    );
  });
});
