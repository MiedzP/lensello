/**
 * Result shape for this route's Server Actions. See the sibling file at
 * `/library/gallery-state.ts` for why this lives outside `actions.ts`.
 */

export interface GalleryAdminState {
  error: string | null;
  message: string | null;
}

export const GALLERY_ADMIN_IDLE: GalleryAdminState = { error: null, message: null };
