/**
 * Verifying that a webhook really came from Stripe.
 *
 * This is the whole security of the endpoint. It marks deposits as paid, so an
 * unverified caller could mark every gig settled and the studio would ship work
 * for money it never received.
 *
 * Stripe signs `${timestamp}.${rawBody}` with HMAC-SHA256 and sends
 * `Stripe-Signature: t=<timestamp>,v1=<signature>`. Three things have to be
 * checked, and skipping any one of them defeats the others:
 *
 *  1. the signature matches, using the RAW body — re-serialising parsed JSON
 *     changes the bytes and the signature will never match;
 *  2. the comparison is constant time;
 *  3. the timestamp is recent, or a captured request can be replayed forever.
 *
 * Pure and separated from the route so all three can be tested.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/** Stripe's own recommended tolerance. */
export const DEFAULT_TOLERANCE_SECONDS = 300;

export type SignatureFailure =
  | 'missing_header'
  | 'malformed_header'
  | 'no_signature'
  | 'timestamp_out_of_tolerance'
  | 'signature_mismatch';

export function parseSignatureHeader(
  header: string | null,
): { timestamp: number; signatures: string[] } | SignatureFailure {
  if (!header) return 'missing_header';

  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const part of header.split(',')) {
    const [key, value] = part.split('=', 2);
    if (!key || !value) continue;
    if (key.trim() === 't') timestamp = Number(value.trim());
    // v1 specifically. Stripe may add newer schemes, and accepting an unknown
    // one would mean trusting a signature we do not know how to compute.
    if (key.trim() === 'v1') signatures.push(value.trim());
  }

  if (timestamp === null || Number.isNaN(timestamp)) return 'malformed_header';
  if (signatures.length === 0) return 'no_signature';

  return { timestamp, signatures };
}

export function verifyStripeSignature(input: {
  rawBody: string;
  header: string | null;
  secret: string;
  nowSeconds: number;
  toleranceSeconds?: number;
}): SignatureFailure | null {
  const parsed = parseSignatureHeader(input.header);
  if (typeof parsed === 'string') return parsed;

  const tolerance = input.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (Math.abs(input.nowSeconds - parsed.timestamp) > tolerance) {
    return 'timestamp_out_of_tolerance';
  }

  const expected = createHmac('sha256', input.secret)
    .update(`${parsed.timestamp}.${input.rawBody}`)
    .digest('hex');

  const expectedBuffer = Buffer.from(expected, 'utf8');

  // Stripe can send several v1 signatures during a secret rotation; any one
  // matching is a valid request.
  const matched = parsed.signatures.some((candidate) => {
    const candidateBuffer = Buffer.from(candidate, 'utf8');
    if (candidateBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(candidateBuffer, expectedBuffer);
  });

  return matched ? null : 'signature_mismatch';
}
