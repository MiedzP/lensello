'use server';

/**
 * The buying page's Server Actions.
 *
 * No `requireUser()` here — a wedding guest holding a share link has no
 * account. Every action re-resolves the gallery from the token instead (see
 * `authorizeShopToken`), and every write on the basket re-checks that the
 * basket actually belongs to that gallery before touching it.
 */

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { authorizeShopToken } from '@/lib/prints/shop-auth';
import {
  addCartItem,
  createCart,
  listCartItems,
  loadCart,
  removeCartItem,
  saveContactAndShipping,
  updateCartItemQuantity,
  CartError,
} from '@/lib/prints/cart';
import { cartCookieName, cartCookieValue, verifyCartCookie, CART_COOKIE_TTL_SECONDS } from '@/lib/prints/cart-cookie';
import { startCheckout, CheckoutError } from '@/lib/prints/checkout';
import type { CropRect } from '@/lib/prints/resolution';
import type { ShopState } from './shop-state';
import { SHOP_IDLE } from './shop-state';

async function setCartCookie(galleryId: string, orderId: string): Promise<void> {
  const store = await cookies();
  store.set(cartCookieName(galleryId), cartCookieValue(orderId, galleryId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/g',
    maxAge: CART_COOKIE_TTL_SECONDS,
  });
}

const cropSchema = z
  .object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })
  .nullable();

function parseCrop(raw: FormDataEntryValue | null): CropRect | null {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const parsed = cropSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function addToBasket(_previous: ShopState, formData: FormData): Promise<ShopState> {
  const auth = await authorizeShopToken(formData.get('token'));
  if (auth.ok === false) return { ...SHOP_IDLE, error: auth.error };
  const { admin, resolved } = auth;
  const galleryId = resolved.gallery.id;

  const productId = formData.get('productId');
  const assetId = formData.get('assetId');
  const quantity = Number(formData.get('quantity') ?? '1');
  if (typeof productId !== 'string' || typeof assetId !== 'string') {
    return { ...SHOP_IDLE, error: 'Choose a photograph and a product first.' };
  }

  const store = await cookies();
  const existingOrderId = verifyCartCookie(store.get(cartCookieName(galleryId))?.value, galleryId);
  let cart = existingOrderId ? await loadCart(admin, existingOrderId, galleryId) : null;
  if (!cart || cart.status !== 'cart') {
    cart = await createCart(admin, galleryId);
    await setCartCookie(galleryId, cart.id);
  }

  try {
    await addCartItem(admin, cart, resolved.gallery.shoot_id, {
      productId,
      assetId,
      quantity: Number.isFinite(quantity) ? quantity : 1,
      crop: parseCrop(formData.get('crop')),
    });
  } catch (cause) {
    return { ...SHOP_IDLE, error: cause instanceof CartError ? cause.message : 'Could not add that to the basket.' };
  }

  revalidatePath(`/g/${formData.get('token')}/shop`);
  return { ...SHOP_IDLE, message: 'Added to your basket.' };
}

export async function updateBasketQuantity(_previous: ShopState, formData: FormData): Promise<ShopState> {
  const auth = await authorizeShopToken(formData.get('token'));
  if (auth.ok === false) return { ...SHOP_IDLE, error: auth.error };
  const { admin, resolved } = auth;

  const store = await cookies();
  const orderId = verifyCartCookie(store.get(cartCookieName(resolved.gallery.id))?.value, resolved.gallery.id);
  const itemId = formData.get('itemId');
  const quantity = Number(formData.get('quantity'));

  if (!orderId || typeof itemId !== 'string') return { ...SHOP_IDLE, error: 'Your basket could not be found.' };

  const cart = await loadCart(admin, orderId, resolved.gallery.id);
  if (!cart) return { ...SHOP_IDLE, error: 'Your basket could not be found.' };

  try {
    await updateCartItemQuantity(admin, cart, itemId, quantity);
  } catch (cause) {
    return { ...SHOP_IDLE, error: cause instanceof CartError ? cause.message : 'Could not update that line.' };
  }

  revalidatePath(`/g/${formData.get('token')}/shop`);
  return SHOP_IDLE;
}

export async function removeFromBasket(_previous: ShopState, formData: FormData): Promise<ShopState> {
  const auth = await authorizeShopToken(formData.get('token'));
  if (auth.ok === false) return { ...SHOP_IDLE, error: auth.error };
  const { admin, resolved } = auth;

  const store = await cookies();
  const orderId = verifyCartCookie(store.get(cartCookieName(resolved.gallery.id))?.value, resolved.gallery.id);
  const itemId = formData.get('itemId');

  if (!orderId || typeof itemId !== 'string') return { ...SHOP_IDLE, error: 'Your basket could not be found.' };

  const cart = await loadCart(admin, orderId, resolved.gallery.id);
  if (!cart) return { ...SHOP_IDLE, error: 'Your basket could not be found.' };

  try {
    await removeCartItem(admin, cart, itemId);
  } catch (cause) {
    return { ...SHOP_IDLE, error: cause instanceof CartError ? cause.message : 'Could not remove that line.' };
  }

  revalidatePath(`/g/${formData.get('token')}/shop`);
  return SHOP_IDLE;
}

const detailsSchema = z.object({
  contactName: z.string().trim().min(1, 'Add your name.').max(120),
  contactEmail: z.string().trim().email('Add a valid email — this is where your receipt goes.'),
  shipLine1: z.string().trim().min(1, 'Add your address.').max(200),
  shipLine2: z.string().trim().max(200).optional(),
  shipCity: z.string().trim().min(1, 'Add your town or city.').max(120),
  shipPostcode: z.string().trim().min(1, 'Add your postcode.').max(20),
  shipCountry: z.string().trim().length(2, 'Use a two-letter country code, e.g. GB.'),
  notes: z.string().trim().max(1000).optional(),
});

export async function saveDetailsAndCheckout(_previous: ShopState, formData: FormData): Promise<ShopState> {
  const auth = await authorizeShopToken(formData.get('token'));
  if (auth.ok === false) return { ...SHOP_IDLE, error: auth.error };
  const { admin, resolved } = auth;
  const token = formData.get('token') as string;

  const store = await cookies();
  const orderId = verifyCartCookie(store.get(cartCookieName(resolved.gallery.id))?.value, resolved.gallery.id);
  if (!orderId) return { ...SHOP_IDLE, error: 'Your basket is empty.' };

  const cart = await loadCart(admin, orderId, resolved.gallery.id);
  if (!cart) return { ...SHOP_IDLE, error: 'Your basket could not be found.' };

  const items = await listCartItems(admin, cart.id);
  if (items.length === 0) return { ...SHOP_IDLE, error: 'Your basket is empty.' };

  const parsed = detailsSchema.safeParse({
    contactName: formData.get('contactName'),
    contactEmail: formData.get('contactEmail'),
    shipLine1: formData.get('shipLine1'),
    shipLine2: formData.get('shipLine2') || undefined,
    shipCity: formData.get('shipCity'),
    shipPostcode: formData.get('shipPostcode'),
    shipCountry: formData.get('shipCountry') || 'GB',
    notes: formData.get('notes') || undefined,
  });

  if (!parsed.success) {
    return { ...SHOP_IDLE, error: parsed.error.issues[0]?.message ?? 'Check your details.' };
  }

  try {
    await saveContactAndShipping(admin, cart, {
      contactName: parsed.data.contactName,
      contactEmail: parsed.data.contactEmail,
      shipLine1: parsed.data.shipLine1,
      shipLine2: parsed.data.shipLine2 ?? null,
      shipCity: parsed.data.shipCity,
      shipPostcode: parsed.data.shipPostcode,
      shipCountry: parsed.data.shipCountry.toUpperCase(),
      notes: parsed.data.notes ?? null,
    });
  } catch (cause) {
    return { ...SHOP_IDLE, error: cause instanceof CartError ? cause.message : 'Could not save your details.' };
  }

  const refreshedCart = await loadCart(admin, orderId, resolved.gallery.id);
  if (!refreshedCart) return { ...SHOP_IDLE, error: 'Your basket could not be found.' };

  const returnBaseUrl = process.env.LENSELLO_PUBLIC_URL?.trim() || 'https://lensello-web-kappa.vercel.app';

  try {
    const { checkoutUrl } = await startCheckout(admin, refreshedCart, items, {
      returnBaseUrl,
      galleryToken: token,
    });
    return { ...SHOP_IDLE, checkoutUrl };
  } catch (cause) {
    return { ...SHOP_IDLE, error: cause instanceof CheckoutError ? cause.message : 'Could not start checkout.' };
  }
}
