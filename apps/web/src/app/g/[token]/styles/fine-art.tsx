/**
 * Fine art: one photograph per screen, with room to breathe.
 *
 * The opposite instinct from `mosaic` — instead of showing as much as
 * possible at once, this shows exactly one thing and asks the client to sit
 * with it for a moment before the next. Sections become chapter title cards,
 * each its own screen, because a gallery presented this slowly needs the same
 * pauses a book would give it between parts.
 *
 * A Server Component. The pacing comes from `scroll-snap-stop: always` and
 * generous `min-height`s, not from anything that needs the browser's state.
 */

import Image from 'next/image';
import type { DisplaySection } from '@/lib/galleries/sections';
import { Watermark, aspectRatioOf, type StyleProps } from './shared';

export function FineArt({
  sections,
  accentColor,
  watermark,
  renderOverlay,
}: { sections: DisplaySection[]; accentColor: string | null } & StyleProps) {
  const showChapters = sections.length > 1 || sections.some((section) => section.title);

  return (
    <div className="snap-y snap-proximity">
      {sections.map((section, sectionIndex) => (
        <div key={section.id ?? `section-${sectionIndex}`}>
          {showChapters && section.title ? (
            <div
              className="flex min-h-[60vh] snap-start flex-col items-center justify-center px-6 text-center [scroll-snap-stop:always]"
            >
              <p className="text-xs font-medium uppercase tracking-[0.25em] text-faint">
                Chapter {sectionIndex + 1}
              </p>
              <h2
                className="mt-3 text-3xl font-light tracking-tight text-foreground"
                style={accentColor ? { color: accentColor } : undefined}
              >
                {section.title}
              </h2>
              {section.blurb ? (
                <p className="mt-4 max-w-md text-sm text-muted">{section.blurb}</p>
              ) : null}
            </div>
          ) : null}

          {section.photos.map((photo) => (
            <figure
              key={photo.id}
              className="group relative flex min-h-[92vh] snap-start flex-col items-center justify-center gap-4 px-6 py-12 [scroll-snap-stop:always] sm:px-16"
            >
              <div
                className="relative w-full max-w-4xl"
                style={{ aspectRatio: aspectRatioOf(photo), maxHeight: '78vh' }}
              >
                <Image
                  src={photo.url}
                  alt={photo.altText ?? photo.filename}
                  fill
                  sizes="(min-width: 1024px) 70vw, 92vw"
                  className="object-contain"
                />
                {watermark ? <Watermark /> : null}
              </div>
              <div>{renderOverlay(photo)}</div>
            </figure>
          ))}
        </div>
      ))}
    </div>
  );
}
