'use client';

/**
 * Film strip: one large viewer, with a scrubbable rail of every frame below
 * it.
 *
 * Modelled on reviewing a strip of negatives on a light table: one frame held
 * up at a time, the rest of the roll laid out in a row so the next one is a
 * glance away. State (which frame is up) has to live in the browser, so this
 * is the one style that cannot be a Server Component.
 */

import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GalleryPhoto } from '@/lib/galleries/queries';
import { Watermark, type StyleProps } from './shared';

export function FilmStrip({ photos, watermark, renderOverlay }: { photos: GalleryPhoto[] } & StyleProps) {
  const [index, setIndex] = useState(0);
  const current = photos[index];

  if (!current) return null;

  const goTo = (next: number) => setIndex(Math.max(0, Math.min(photos.length - 1, next)));

  return (
    <div className="flex flex-col gap-4">
      <div className="relative mx-auto flex w-full max-w-4xl items-center">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          aria-label="Previous photograph"
          className="absolute left-1 z-10 rounded-full bg-black/50 p-2 text-white backdrop-blur transition-opacity hover:bg-black/70 disabled:opacity-0"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>

        <figure className="group relative aspect-[3/2] w-full overflow-hidden rounded-lg bg-black">
          <Image
            key={current.id}
            src={current.url}
            alt={current.altText ?? current.filename}
            fill
            sizes="(min-width: 1024px) 60vw, 90vw"
            className="object-contain"
          />
          {watermark ? <Watermark /> : null}
          <div className="absolute bottom-3 right-3">{renderOverlay(current)}</div>
        </figure>

        <button
          type="button"
          onClick={() => goTo(index + 1)}
          disabled={index === photos.length - 1}
          aria-label="Next photograph"
          className="absolute right-1 z-10 rounded-full bg-black/50 p-2 text-white backdrop-blur transition-opacity hover:bg-black/70 disabled:opacity-0"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      <p className="text-center text-xs tabular-nums text-muted">
        {index + 1} / {photos.length}
      </p>

      <div
        role="listbox"
        aria-label="All photographs"
        className="flex gap-1.5 overflow-x-auto px-1 pb-2"
      >
        {photos.map((photo, photoIndex) => (
          <button
            key={photo.id}
            type="button"
            role="option"
            aria-selected={photoIndex === index}
            aria-label={`Photograph ${photoIndex + 1}`}
            onClick={() => setIndex(photoIndex)}
            className={cn(
              'relative h-16 w-24 shrink-0 overflow-hidden rounded-sm ring-2 transition-[opacity,box-shadow]',
              photoIndex === index
                ? 'opacity-100 ring-accent'
                : 'opacity-55 ring-transparent hover:opacity-90',
            )}
          >
            <Image
              src={photo.url}
              alt=""
              fill
              sizes="96px"
              className="object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
