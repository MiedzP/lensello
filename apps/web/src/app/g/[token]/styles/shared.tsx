/**
 * Pieces every display style needs.
 *
 * `renderOverlay` is how a style stays purely about layout: the favourite
 * heart and the download link belong to whoever is showing the gallery — the
 * token-gated `/g/[token]` route and the session-gated portal both have their
 * own server actions for those — so a style component never imports either
 * one. It receives a photograph and hands back whatever markup its caller
 * wants sitting on top of it.
 */

import type { ReactNode } from 'react';
import type { GalleryPhoto } from '@/lib/galleries/queries';

export interface StyleProps {
  watermark: boolean;
  renderOverlay: (photo: GalleryPhoto) => ReactNode;
}

/** The one watermark treatment, so five styles don't each invent their own. */
export function Watermark() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <span className="rotate-[-20deg] text-lg font-semibold tracking-widest text-white/35">
        PROOF
      </span>
    </div>
  );
}

/** A photograph's aspect ratio, or a plausible default for one with no dimensions on file. */
export function aspectRatioOf(photo: GalleryPhoto): string {
  return photo.width && photo.height ? `${photo.width} / ${photo.height}` : '3 / 2';
}
