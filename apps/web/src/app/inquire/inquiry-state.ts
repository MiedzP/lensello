/**
 * Result shapes and their initial values for this module's Server Actions.
 *
 * Outside `actions.ts` because a `'use server'` module may only export async
 * functions: every export in one becomes an HTTP endpoint, so a plain object
 * is rejected at runtime with "a 'use server' file can only export async
 * functions, found object". The page 500s and the build says nothing, because
 * it is not a build-time error.
 */

export interface InquiryState {
  sent: boolean;
  error: string | null;
  /** False when no confirmation actually went out, so the copy can be honest. */
  emailed: boolean;
  /** Shown after a successful submit, when a date was given. */
  availability: 'open' | 'taken' | null;
}

export const INQUIRY_IDLE: InquiryState = {
  sent: false,
  error: null,
  emailed: false,
  availability: null,
};
