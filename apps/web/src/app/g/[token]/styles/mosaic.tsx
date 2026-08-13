'use client';

/**
 * Mosaic: dense, justified rows.
 *
 * A true justified layout — each row filled edge to edge by scaling every
 * photograph in it to one shared row height, the way Flickr and Google
 * Photos lay out a dense grid — rather than the easier trick of cropping
 * everything to a uniform square. That crop is what `contact_sheet` is for;
 * a mosaic that also squared everything off would just be the same layout
 * twice.
 *
 * The row height depends on the container's actual width, so this has to be a
 * client component: server-rendered HTML has no way to know how wide the
 * gallery is on a given visitor's screen before it paints.
 */

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { GalleryPhoto } from '@/lib/galleries/queries';
import { Watermark, type StyleProps } from './shared';

const GAP = 6;

/** Narrower screens get shorter rows — otherwise a phone shows two photos per row at most. */
function targetRowHeight(containerWidth: number): number {
  if (containerWidth < 480) return 130;
  if (containerWidth < 900) return 190;
  return 260;
}

interface Row {
  photos: GalleryPhoto[];
  height: number;
}

function ratioOf(photo: GalleryPhoto): number {
  return photo.width && photo.height ? photo.width / photo.height : 1.5;
}

/**
 * Packs photographs into rows that each fill `containerWidth` exactly, by
 * scaling every photo in the row to a shared height. The last, partial row is
 * left at the target height rather than stretched — over-enlarging four
 * leftover frames to fill the width would make them look wrong-sized next to
 * every row above them.
 */
function layoutRows(photos: GalleryPhoto[], containerWidth: number): Row[] {
  if (containerWidth <= 0) return [];

  const target = targetRowHeight(containerWidth);
  const rows: Row[] = [];
  let current: GalleryPhoto[] = [];
  let ratioSum = 0;

  for (const photo of photos) {
    current.push(photo);
    ratioSum += ratioOf(photo);

    const widthAtTarget = ratioSum * target + GAP * (current.length - 1);
    if (widthAtTarget >= containerWidth) {
      const scale = (containerWidth - GAP * (current.length - 1)) / (ratioSum * target);
      // Capped so a row of very narrow (tall) photos doesn't blow up to an
      // absurd height just to reach the container's edges.
      rows.push({ photos: current, height: target * Math.min(scale, 1.4) });
      current = [];
      ratioSum = 0;
    }
  }

  if (current.length > 0) rows.push({ photos: current, height: target });

  return rows;
}

export function Mosaic({ photos, watermark, renderOverlay }: { photos: GalleryPhoto[] } & StyleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const rows = layoutRows(photos, width);

  return (
    <div ref={containerRef} className="flex flex-col gap-1.5">
      {/* Renders nothing until the first measurement lands, rather than a
          guessed width that would reflow visibly a moment later. */}
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex gap-1.5">
          {row.photos.map((photo) => {
            const photoWidth = row.height * ratioOf(photo);
            return (
              <figure
                key={photo.id}
                className="group relative shrink-0 overflow-hidden rounded-sm bg-surface-raised"
                style={{ width: photoWidth, height: row.height }}
              >
                <Image
                  src={photo.url}
                  alt={photo.altText ?? photo.filename}
                  fill
                  sizes={`${Math.round(photoWidth)}px`}
                  className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                />
                {watermark ? <Watermark /> : null}
                {renderOverlay(photo)}
              </figure>
            );
          })}
        </div>
      ))}
    </div>
  );
}
