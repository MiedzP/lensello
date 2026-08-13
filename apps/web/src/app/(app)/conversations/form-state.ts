/**
 * Result shapes and their initial values for this module's Server Actions.
 *
 * Kept out of `actions.ts`: a `'use server'` module may only export async
 * functions, so a plain object export there is a runtime error, not a
 * build-time one — see `lib/clients/form-state.ts` for the same note.
 */

export interface ReplyState {
  sent: boolean;
  error: string | null;
  token: number;
  /** Successful sends only — used as a React `key` to clear the composer. */
  sentCount: number;
}

export const INITIAL_REPLY: ReplyState = {
  sent: false,
  error: null,
  token: 0,
  sentCount: 0,
};

export interface SimpleState {
  error: string | null;
  message: string | null;
  token: number;
}

export const INITIAL_SIMPLE: SimpleState = { error: null, message: null, token: 0 };
