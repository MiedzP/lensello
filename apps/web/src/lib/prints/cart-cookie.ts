/**
 * Remembering a visitor's basket without a session.
 *
 * A gallery visitor has no account, so the basket has to be found some other
 * way — and the obvious way, "the client sends back the order id", is also
 * the obvious way for anyone to hijack someone else's basket by guessing or
 * enumerating uuids. The cookie instead holds an HMAC over the order id and
 * the gallery id it belongs to, signed with the deployment secret, so an
 * order id on its own proves nothing: only a value this server produced will
 * verify.
 *
 * Same construction as `lib/galleries/unlock.ts`, with its own domain string
 * so a cart cookie and a gallery-unlock cookie can never be swapped for one
 * another.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/** Long enough for someone to finish choosing prints across a few sittings. */
export const CART_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 14;

export function cartCookieName(galleryId: string): string {
  return `lensello_cart_${galleryId}`;
}

function secret(): string {
  const key = process.env.LENSELLO_ENCRYPTION_KEY?.trim();
  if (!key) {
    throw new Error(
      'LENSELLO_ENCRYPTION_KEY is not set, so a basket cannot be signed.',
    );
  }
  return key;
}

export function signCart(orderId: string, galleryId: string): string {
  return createHmac('sha256', secret())
    .update(`print-cart:${galleryId}:${orderId}`)
    .digest('base64url');
}

export function cartCookieValue(orderId: string, galleryId: string): string {
  return `${orderId}.${signCart(orderId, galleryId)}`;
}

/** Returns the order id the cookie names, or null if it does not verify. */
export function verifyCartCookie(value: string | undefined, galleryId: string): string | null {
  if (!value) return null;

  const separator = value.lastIndexOf('.');
  if (separator <= 0) return null;

  const orderId = value.slice(0, separator);
  const signature = value.slice(separator + 1);

  const expected = signCart(orderId, galleryId);
  const a = Buffer.from(signature, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return null;

  return timingSafeEqual(a, b) ? orderId : null;
}
