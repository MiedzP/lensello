import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  parseSignatureHeader,
  verifyStripeSignature,
} from './stripe-signature';

const SECRET = 'whsec_test_secret';
const BODY = '{"id":"evt_1","type":"checkout.session.completed"}';
const NOW = 1_800_000_000;

function sign(body: string, timestamp: number, secret = SECRET): string {
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

/**
 * This endpoint marks deposits as paid. If verification is wrong, anyone who
 * finds the URL can mark every gig settled and the studio ships work for money
 * it never received — and nothing about the app would look broken.
 */
describe('verifyStripeSignature', () => {
  it('accepts a correctly signed, recent request', () => {
    expect(
      verifyStripeSignature({
        rawBody: BODY,
        header: sign(BODY, NOW),
        secret: SECRET,
        nowSeconds: NOW,
      }),
    ).toBeNull();
  });

  it('rejects a signature made with a different secret', () => {
    expect(
      verifyStripeSignature({
        rawBody: BODY,
        header: sign(BODY, NOW, 'whsec_wrong'),
        secret: SECRET,
        nowSeconds: NOW,
      }),
    ).toBe('signature_mismatch');
  });

  it('rejects a tampered body', () => {
    // The attack this stops: capture a real webhook, change the amount or the
    // gig id, replay it.
    const header = sign(BODY, NOW);
    expect(
      verifyStripeSignature({
        rawBody: BODY.replace('evt_1', 'evt_2'),
        header,
        secret: SECRET,
        nowSeconds: NOW,
      }),
    ).toBe('signature_mismatch');
  });

  it('rejects a replay from outside the tolerance window', () => {
    expect(
      verifyStripeSignature({
        rawBody: BODY,
        header: sign(BODY, NOW - 3600),
        secret: SECRET,
        nowSeconds: NOW,
      }),
    ).toBe('timestamp_out_of_tolerance');
  });

  it('rejects a timestamp too far in the future', () => {
    // Symmetric on purpose: a clock skewed forward should not be a way in.
    expect(
      verifyStripeSignature({
        rawBody: BODY,
        header: sign(BODY, NOW + 3600),
        secret: SECRET,
        nowSeconds: NOW,
      }),
    ).toBe('timestamp_out_of_tolerance');
  });

  it('accepts one valid signature among several, as sent during a rotation', () => {
    const valid = sign(BODY, NOW).split('v1=')[1];
    expect(
      verifyStripeSignature({
        rawBody: BODY,
        header: `t=${NOW},v1=${'0'.repeat(64)},v1=${valid}`,
        secret: SECRET,
        nowSeconds: NOW,
      }),
    ).toBeNull();
  });

  it('rejects a missing or unusable header', () => {
    const base = { rawBody: BODY, secret: SECRET, nowSeconds: NOW };
    expect(verifyStripeSignature({ ...base, header: null })).toBe('missing_header');
    expect(verifyStripeSignature({ ...base, header: 'nonsense' })).toBe('malformed_header');
    expect(verifyStripeSignature({ ...base, header: `t=${NOW}` })).toBe('no_signature');
  });

  it('ignores signature schemes it does not know how to compute', () => {
    // Accepting a v0 or a future v2 would mean trusting something we cannot
    // actually verify.
    expect(
      verifyStripeSignature({
        rawBody: BODY,
        header: `t=${NOW},v0=${'a'.repeat(64)}`,
        secret: SECRET,
        nowSeconds: NOW,
      }),
    ).toBe('no_signature');
  });
});

describe('parseSignatureHeader', () => {
  it('pulls out the timestamp and signatures', () => {
    const parsed = parseSignatureHeader(`t=${NOW},v1=abc,v1=def`);
    expect(parsed).toEqual({ timestamp: NOW, signatures: ['abc', 'def'] });
  });

  it('rejects a non-numeric timestamp', () => {
    expect(parseSignatureHeader('t=nope,v1=abc')).toBe('malformed_header');
  });
});
