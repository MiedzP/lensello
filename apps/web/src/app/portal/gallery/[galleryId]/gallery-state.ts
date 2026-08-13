/**
 * Result shape for this route's Server Actions. See the sibling file at
 * `/g/[token]/gallery-state.ts` for why this lives outside `actions.ts`.
 */

export interface PortalGalleryState {
  error: string | null;
  message: string | null;
}

export const PORTAL_GALLERY_IDLE: PortalGalleryState = { error: null, message: null };
