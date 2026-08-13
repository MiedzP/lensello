/**
 * Result shapes and their initial values for this module's Server Actions.
 *
 * Outside `actions.ts` because a `'use server'` module may only export async
 * functions — see the identical note in every other module's `*-state.ts`.
 */

export interface OrderActionState {
  error: string | null;
  message: string | null;
}

export const ORDER_ACTION_IDLE: OrderActionState = { error: null, message: null };
