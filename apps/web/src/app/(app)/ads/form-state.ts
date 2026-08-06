/**
 * Result shapes and their initial values for this module's Server Actions.
 *
 * Outside `actions.ts` because a `'use server'` module may only export async
 * functions: every export in one becomes an HTTP endpoint, so a plain object
 * is rejected at runtime with "a 'use server' file can only export async
 * functions, found object". The page 500s and the build says nothing, because
 * it is not a build-time error.
 */

export interface AdFormState {
  error: string | null;
  /** Set on a successful save, so the edit form can confirm rather than
   *  just going quiet. `createAd` redirects instead. */
  saved?: boolean;
}

export const EMPTY_FORM_STATE: AdFormState = { error: null };
