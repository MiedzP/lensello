/**
 * Result shapes and their initial values for this module's Server Actions.
 *
 * Outside `actions.ts` because a `'use server'` module may only export async
 * functions: every export in one becomes an HTTP endpoint, so a plain object
 * is rejected at runtime with "a 'use server' file can only export async
 * functions, found object". The page 500s and the build says nothing, because
 * it is not a build-time error.
 */

export interface CreativeState {
  error: string | null;
  message: string | null;
  /** Data URL of the last render, so it can be previewed and downloaded. */
  preview: string | null;
  /** Set once saved, so the UI can link to the shoot it landed in. */
  savedAssetId: string | null;
}

export const CREATIVE_IDLE: CreativeState = {
  error: null,
  message: null,
  preview: null,
  savedAssetId: null,
};
