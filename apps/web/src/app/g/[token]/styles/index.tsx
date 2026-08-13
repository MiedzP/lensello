/**
 * Picks the right browsing experience for a gallery's `display_style`.
 *
 * `mosaic`, `contact_sheet` and `film_strip` are the dense, flat experiences
 * and always see every photograph as one list — sections exist for the
 * studio's own organisation and for the two slower styles, and would only
 * break the rhythm here. `fine_art` and `story` are the ones sections were
 * built for, so they alone receive the chaptered form.
 */

import type { ReactNode } from 'react';
import type { DisplayStyle, GalleryPhoto } from '@/lib/galleries/queries';
import type { DisplaySection } from '@/lib/galleries/sections';
import { Mosaic } from './mosaic';
import { ContactSheet } from './contact-sheet';
import { FilmStrip } from './film-strip';
import { FineArt } from './fine-art';
import { Story } from './story';

export interface GalleryDisplayProps {
  style: DisplayStyle;
  photos: GalleryPhoto[];
  sections: DisplaySection[];
  accentColor: string | null;
  watermark: boolean;
  renderOverlay: (photo: GalleryPhoto) => ReactNode;
}

export function GalleryDisplay({
  style,
  photos,
  sections,
  accentColor,
  watermark,
  renderOverlay,
}: GalleryDisplayProps) {
  switch (style) {
    case 'fine_art':
      return (
        <FineArt
          sections={sections}
          accentColor={accentColor}
          watermark={watermark}
          renderOverlay={renderOverlay}
        />
      );
    case 'story':
      return (
        <Story
          sections={sections}
          accentColor={accentColor}
          watermark={watermark}
          renderOverlay={renderOverlay}
        />
      );
    case 'film_strip':
      return <FilmStrip photos={photos} watermark={watermark} renderOverlay={renderOverlay} />;
    case 'contact_sheet':
      return <ContactSheet photos={photos} watermark={watermark} renderOverlay={renderOverlay} />;
    case 'mosaic':
    default:
      return <Mosaic photos={photos} watermark={watermark} renderOverlay={renderOverlay} />;
  }
}
