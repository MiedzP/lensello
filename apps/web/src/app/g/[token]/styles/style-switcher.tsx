'use client';

/**
 * Lets a viewer browse the same photographs in a different style, entirely on
 * their own screen. It never writes anything back to the database, so it
 * cannot be the thing that changes what the studio — or the next visitor —
 * sees when the gallery loads again.
 *
 * Shared between `/g/[token]` and the portal's gallery view, which are the two
 * places a client ever looks at a gallery.
 */

import { cn } from '@/lib/utils';
import { DISPLAY_STYLE_INFO, DISPLAY_STYLES, type DisplayStyle } from '@/lib/galleries/queries';

/** `fine_art` and `story` want the full width of the viewport; the rest read better held to the page's usual measure. */
export function isImmersiveStyle(style: DisplayStyle): boolean {
  return style === 'fine_art' || style === 'story';
}

export function StyleSwitcher({
  style,
  onChange,
}: {
  style: DisplayStyle;
  onChange: (style: DisplayStyle) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="How photographs are displayed"
      className="mb-6 flex flex-wrap justify-center gap-1.5 px-4"
    >
      {DISPLAY_STYLES.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === style}
          title={DISPLAY_STYLE_INFO[option].description}
          onClick={() => onChange(option)}
          className={cn(
            'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
            option === style
              ? 'border-accent bg-accent-subtle text-accent'
              : 'border-subtle text-muted hover:border-strong hover:text-foreground',
          )}
        >
          {DISPLAY_STYLE_INFO[option].label}
        </button>
      ))}
    </div>
  );
}
