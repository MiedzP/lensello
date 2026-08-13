/**
 * Contact sheet: a uniform proof grid with frame numbers.
 *
 * Every cell is the same size and the border between them is a single hairline
 * — the darkroom object this is modelled on is one continuous sheet of paper
 * with a whole roll printed on it, not a set of individually framed photos.
 * The frame numbers are what let a client say "I want 014 and 032" the way
 * they would to a lab, so they render even when a photograph has no other
 * caption.
 *
 * A Server Component: nothing here depends on the viewport, so there is no
 * reason to ship it to the client.
 */

import Image from 'next/image';
import type { GalleryPhoto } from '@/lib/galleries/queries';
import { Watermark, type StyleProps } from './shared';

export function ContactSheet({ photos, watermark, renderOverlay }: { photos: GalleryPhoto[] } & StyleProps) {
  return (
    <div className="grid grid-cols-3 gap-px bg-strong sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {photos.map((photo, index) => (
        <figure key={photo.id} className="group relative aspect-square overflow-hidden bg-canvas">
          <Image
            src={photo.url}
            alt={photo.altText ?? photo.filename}
            fill
            sizes="(min-width: 1024px) 17vw, (min-width: 640px) 25vw, 33vw"
            className="object-cover opacity-90 grayscale-[15%] transition-[opacity,filter] duration-200 group-hover:opacity-100 group-hover:grayscale-0"
          />

          <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-white/85">
            {String(index + 1).padStart(3, '0')}
          </span>

          {watermark ? <Watermark /> : null}
          {renderOverlay(photo)}
        </figure>
      ))}
    </div>
  );
}
