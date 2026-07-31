'use client';

import Image from 'next/image';
import { BookmarkCheck, ImageOff, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AssetView } from '@/lib/library/queries';
import { StarRating } from './star-rating';

/**
 * One photo in the shoot grid.
 *
 * Carries the two controls used constantly while culling — rating and the
 * select flag — and opens the detail panel for everything else.
 */
export function AssetTile({
  asset,
  isChecked,
  isOpen,
  disabled,
  onToggleCheck,
  onOpen,
  onRate,
  onToggleSelect,
}: {
  asset: AssetView;
  isChecked: boolean;
  isOpen: boolean;
  disabled: boolean;
  onToggleCheck: (assetId: string, checked: boolean) => void;
  onOpen: (assetId: string) => void;
  onRate: (assetId: string, rating: number) => void;
  onToggleSelect: (assetId: string, isSelect: boolean) => void;
}) {
  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-lg border bg-surface transition-colors',
        isOpen ? 'border-accent' : isChecked ? 'border-strong' : 'border-subtle',
      )}
    >
      <div className="relative aspect-square w-full bg-surface-raised">
        <button
          type="button"
          onClick={() => onOpen(asset.id)}
          aria-label={`Open details for ${asset.filename}`}
          className="absolute inset-0 h-full w-full cursor-zoom-in"
        >
          {asset.url ? (
            <Image
              src={asset.url}
              alt={asset.altText ?? ''}
              fill
              quality={50}
              sizes="(min-width: 1280px) 220px, (min-width: 640px) 30vw, 45vw"
              className="object-cover"
            />
          ) : (
            <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-faint">
              <ImageOff size={20} aria-hidden="true" />
              <span className="text-xs">Preview unavailable</span>
            </span>
          )}
        </button>

        {/* Above the image button, so the checkbox stays clickable. */}
        <label
          className={cn(
            'absolute top-2 left-2 flex size-6 items-center justify-center rounded-md',
            'border border-strong bg-canvas/85 backdrop-blur-sm',
          )}
        >
          <input
            type="checkbox"
            checked={isChecked}
            disabled={disabled}
            onChange={(event) => onToggleCheck(asset.id, event.target.checked)}
            className="size-3.5 accent-accent"
          />
          <span className="sr-only">Select {asset.filename} for bulk actions</span>
        </label>

        {asset.isCover ? (
          <span className="absolute top-2 right-2 rounded-full bg-canvas/85 px-2 py-0.5 text-xs font-medium text-accent">
            Cover
          </span>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 px-2 py-1.5">
        <StarRating
          value={asset.rating}
          disabled={disabled}
          size={13}
          label={`Rating for ${asset.filename}`}
          onRate={(rating) => onRate(asset.id, rating)}
        />

        <button
          type="button"
          disabled={disabled}
          aria-pressed={asset.isSelect}
          aria-label={
            asset.isSelect
              ? `Remove ${asset.filename} from selects`
              : `Add ${asset.filename} to selects`
          }
          onClick={() => onToggleSelect(asset.id, !asset.isSelect)}
          className={cn(
            'rounded p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            asset.isSelect
              ? 'text-accent hover:bg-accent-subtle'
              : 'text-faint hover:bg-surface-hover hover:text-foreground',
          )}
        >
          {asset.isSelect ? (
            <BookmarkCheck size={15} aria-hidden="true" />
          ) : (
            <Star size={15} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
