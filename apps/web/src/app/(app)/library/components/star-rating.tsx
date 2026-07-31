'use client';

import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const STARS = [1, 2, 3, 4, 5] as const;

/**
 * 0–5 star rating.
 *
 * Real buttons in a `radiogroup`, so it is reachable and operable by keyboard.
 * Clicking the current rating clears it back to 0, which is how photographers
 * expect to un-rate a frame.
 */
export function StarRating({
  value,
  onRate,
  disabled,
  size = 15,
  label = 'Rating',
}: {
  value: number;
  onRate: (rating: number) => void;
  disabled?: boolean;
  size?: number;
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex items-center gap-0.5">
      {STARS.map((star) => {
        const isFilled = star <= value;

        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`}
            disabled={disabled}
            onClick={() => onRate(value === star ? 0 : star)}
            className={cn(
              'rounded p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              isFilled ? 'text-warning' : 'text-faint hover:text-muted',
            )}
          >
            <Star size={size} fill={isFilled ? 'currentColor' : 'none'} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
