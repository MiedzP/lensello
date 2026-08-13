/**
 * Result shapes and their initial values for this module's Server Actions.
 *
 * Outside `actions.ts` for the same reason as every other module's
 * `*-state.ts`: a `'use server'` file may only export async functions.
 */

export interface ShopState {
  error: string | null;
  message: string | null;
  /** Set once checkout succeeds, so the client component can navigate the browser there. */
  checkoutUrl: string | null;
}

export const SHOP_IDLE: ShopState = { error: null, message: null, checkoutUrl: null };
