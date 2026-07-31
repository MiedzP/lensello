import Image from 'next/image';
import { ImageOff } from 'lucide-react';
import { Badge } from '@/components/ui';
import { AD_PLATFORM_LABELS } from '@/lib/ads/constants';
import type { AdCreative } from '@/lib/ads/queries';
import type { AdPlatform } from '@lensello/core';

/**
 * Feed-style preview of the creative and copy.
 *
 * Roughly how a Meta or TikTok placement stacks it — image, primary text,
 * headline, CTA — so the studio can see the copy in the shape it will actually
 * be read in, rather than as three form fields. Not pixel-exact to any
 * platform; the point is catching a headline that runs long or an image whose
 * subject sits where the text will land.
 */
export function AdPreview({
  platform,
  headline,
  primaryText,
  callToAction,
  creative,
}: {
  platform: AdPlatform;
  headline: string;
  primaryText: string;
  callToAction: string;
  creative: AdCreative | null;
}) {
  return (
    <div className="mx-auto w-full max-w-sm overflow-hidden rounded-lg border border-subtle bg-surface">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-subtle text-xs font-semibold text-accent">
          L
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-foreground">Lensello</p>
          <p className="text-[11px] text-faint">
            Sponsored · {AD_PLATFORM_LABELS[platform]}
          </p>
        </div>
      </div>

      {primaryText ? (
        <p className="px-3 pb-2.5 text-sm text-foreground">{primaryText}</p>
      ) : (
        <p className="px-3 pb-2.5 text-sm text-faint italic">
          No primary text yet.
        </p>
      )}

      <div className="relative aspect-square w-full bg-surface-raised">
        {creative?.url ? (
          <Image
            src={creative.url}
            // The library's AI-generated description when there is one. Falling
            // back to the filename is not alt text, so it is announced as an
            // unnamed image instead of reading "IMG_4471.jpg" aloud.
            alt={creative.altText ?? ''}
            fill
            sizes="(max-width: 640px) 100vw, 384px"
            quality={75}
            className="object-cover"
          />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-2 text-faint">
            <ImageOff size={24} aria-hidden="true" />
            <span className="text-xs">
              {creative ? 'Preview unavailable' : 'No creative selected'}
            </span>
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-subtle px-3 py-2.5">
        <p className="min-w-0 text-sm font-semibold text-foreground">
          {headline || <span className="font-normal text-faint italic">No headline yet</span>}
        </p>
        <Badge tone="accent" className="shrink-0">
          {callToAction}
        </Badge>
      </div>
    </div>
  );
}
