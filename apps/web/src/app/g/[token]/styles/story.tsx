/**
 * Story: a single continuous scroll, told in chapters.
 *
 * The narrative cousin of `fine_art` — same use of sections as chapters — but
 * without the enforced pause of a full-screen snap per photo. This is scroll
 * as a couple would actually revisit their wedding on a phone on the sofa: one
 * column, keep going, the chapter headings the only structure.
 *
 * A Server Component; nothing here needs the browser's state.
 */

import Image from 'next/image';
import type { DisplaySection } from '@/lib/galleries/sections';
import { Watermark, aspectRatioOf, type StyleProps } from './shared';

export function Story({
  sections,
  accentColor,
  watermark,
  renderOverlay,
}: { sections: DisplaySection[]; accentColor: string | null } & StyleProps) {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 sm:px-6">
      {sections.map((section, sectionIndex) => (
        <section key={section.id ?? `section-${sectionIndex}`} className="pt-14 first:pt-0">
          {section.title ? (
            <div className="mb-10 border-t border-subtle pt-14 text-center first:border-t-0 first:pt-0">
              <p className="text-xs font-medium uppercase tracking-[0.25em] text-faint">
                Chapter {sectionIndex + 1}
              </p>
              <h2
                className="mt-2 text-2xl font-light tracking-tight text-foreground"
                style={accentColor ? { color: accentColor } : undefined}
              >
                {section.title}
              </h2>
              {section.blurb ? (
                <p className="mx-auto mt-3 max-w-md text-sm text-muted">{section.blurb}</p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-8">
            {section.photos.map((photo) => (
              <figure key={photo.id} className="group relative">
                <div
                  className="relative w-full overflow-hidden rounded-md bg-surface-raised"
                  style={{ aspectRatio: aspectRatioOf(photo) }}
                >
                  <Image
                    src={photo.url}
                    alt={photo.altText ?? photo.filename}
                    fill
                    sizes="(min-width: 768px) 42rem, 100vw"
                    className="object-cover"
                  />
                  {watermark ? <Watermark /> : null}
                  <div className="absolute bottom-3 right-3">{renderOverlay(photo)}</div>
                </div>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
