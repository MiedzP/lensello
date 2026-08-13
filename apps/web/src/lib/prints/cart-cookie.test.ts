import { beforeEach, describe, expect, it } from 'vitest';
import { cartCookieValue, verifyCartCookie } from './cart-cookie';

describe('cart cookie', () => {
  beforeEach(() => {
    process.env.LENSELLO_ENCRYPTION_KEY = 'test-secret-do-not-use-in-production';
  });

  const galleryId = '11111111-1111-1111-1111-111111111111';
  const orderId = '22222222-2222-2222-2222-222222222222';

  it('round-trips: a cookie this server signed verifies back to the same order id', () => {
    const cookie = cartCookieValue(orderId, galleryId);
    expect(verifyCartCookie(cookie, galleryId)).toBe(orderId);
  });

  it('rejects a cookie signed for a different gallery', () => {
    const cookie = cartCookieValue(orderId, galleryId);
    const otherGallery = '33333333-3333-3333-3333-333333333333';
    expect(verifyCartCookie(cookie, otherGallery)).toBeNull();
  });

  it('rejects a forged order id with no matching signature', () => {
    const forged = `${orderId}.not-a-real-signature`;
    expect(verifyCartCookie(forged, galleryId)).toBeNull();
  });

  it('rejects an order id that was tampered with after signing', () => {
    const cookie = cartCookieValue(orderId, galleryId);
    const [, signature] = cookie.split('.');
    const tampered = `44444444-4444-4444-4444-444444444444.${signature}`;
    expect(verifyCartCookie(tampered, galleryId)).toBeNull();
  });

  it('returns null for an absent cookie', () => {
    expect(verifyCartCookie(undefined, galleryId)).toBeNull();
  });
});
