'use client';

import { AlertTriangle } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import {
  AD_CALL_TO_ACTIONS,
  HEADLINE_MAX_CHARS,
  PRIMARY_TEXT_MAX_CHARS,
} from '@/lib/ads/constants';
import type { CopyVariant } from '@/lib/ads/schema';

/**
 * The generated copy variants, as pickable options.
 *
 * Two things this deliberately does *not* do:
 *
 * - **Truncate.** The prompt asks for a headline under 40 characters and
 *   primary text under 125. When the model overshoots, the length is shown and
 *   flagged. Quietly cutting it to fit would hide that the copy does not work,
 *   and the user would discover it from the platform's rejection instead.
 * - **Coerce the call to action.** An off-list CTA is displayed as rejected and
 *   simply not applied, leaving whatever the user already chose. Silently
 *   mapping it to the nearest allowed value would put words in the ad that
 *   nobody wrote.
 */
export function CopyVariants({
  variants,
  onApply,
}: {
  variants: readonly CopyVariant[];
  onApply: (variant: CopyVariant) => void;
}) {
  return (
    <ul className="space-y-3">
      {variants.map((variant, index) => {
        const headlineOver = variant.headline.length > HEADLINE_MAX_CHARS;
        const primaryOver = variant.primaryText.length > PRIMARY_TEXT_MAX_CHARS;

        return (
          <li
            key={`${variant.angle}-${index}`}
            className="rounded-md border border-subtle bg-surface-raised p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <Badge tone="accent">{variant.angle}</Badge>
              <Button size="sm" onClick={() => onApply(variant)}>
                Use this
              </Button>
            </div>

            <p className="mt-3 text-sm font-semibold text-foreground">
              {variant.headline}
            </p>
            <CharCount
              length={variant.headline.length}
              limit={HEADLINE_MAX_CHARS}
              over={headlineOver}
              label="Headline"
            />

            <p className="mt-3 text-sm text-foreground">{variant.primaryText}</p>
            <CharCount
              length={variant.primaryText.length}
              limit={PRIMARY_TEXT_MAX_CHARS}
              over={primaryOver}
              label="Primary text"
            />

            <div className="mt-3">
              {variant.callToAction ? (
                <Badge>{variant.callToAction}</Badge>
              ) : (
                <p className="flex items-start gap-1.5 text-xs text-danger">
                  <AlertTriangle
                    size={13}
                    aria-hidden="true"
                    className="mt-0.5 shrink-0"
                  />
                  <span>
                    Suggested call to action{' '}
                    <q className="font-medium">{variant.rawCallToAction}</q> is not
                    one of the {AD_CALL_TO_ACTIONS.length} supported values, so it
                    will not be applied. Pick one yourself above.
                  </span>
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function CharCount({
  length,
  limit,
  over,
  label,
}: {
  length: number;
  limit: number;
  over: boolean;
  label: string;
}) {
  return (
    <p
      className={
        over
          ? 'mt-1 flex items-center gap-1.5 text-xs font-medium text-warning'
          : 'mt-1 text-xs text-faint'
      }
    >
      {over ? (
        <AlertTriangle size={13} aria-hidden="true" className="shrink-0" />
      ) : null}
      <span>
        {label} {length}/{limit} characters
        {over ? ' — over the limit, it will truncate in the feed' : null}
      </span>
    </p>
  );
}
