/**
 * Result shapes and their initial values for this module's Server Actions.
 *
 * Outside `actions.ts` because a `'use server'` module may only export async
 * functions: every export in one becomes an HTTP endpoint, so a plain object
 * is rejected at runtime with "a 'use server' file can only export async
 * functions, found object". The page 500s and the build says nothing, because
 * it is not a build-time error.
 */

export interface ContractAdminState {
  error: string | null;
  message: string | null;
  /** Shown once, immediately after sending. Never retrievable again. */
  shareUrl: string | null;
  /** The rendered draft, so it can be reviewed and edited before sending. */
  draft: string | null;
}

export const CONTRACT_ADMIN_IDLE: ContractAdminState = {
  error: null,
  message: null,
  shareUrl: null,
  draft: null,
};
