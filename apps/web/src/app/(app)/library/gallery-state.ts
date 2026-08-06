/**
 * Result shapes and their initial values for this module's Server Actions.
 *
 * Outside `actions.ts` because a `'use server'` module may only export async
 * functions: every export in one becomes an HTTP endpoint, so a plain object
 * is rejected at runtime with "a 'use server' file can only export async
 * functions, found object". The page 500s and the build says nothing, because
 * it is not a build-time error.
 */

export interface GalleryAdminState {
  error: string | null;
  message: string | null;
  /** Shown once, immediately after creation. Never retrievable again. */
  shareUrl: string | null;
}

export const GALLERY_ADMIN_IDLE: GalleryAdminState = {
  error: null,
  message: null,
  shareUrl: null,
};
