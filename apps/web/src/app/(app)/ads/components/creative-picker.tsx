'use client';

import Image from 'next/image';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CreativeGroup } from '@/lib/ads/queries';

/**
 * Picks one photo from the library as the ad's creative.
 *
 * Radio inputs rather than click handlers on divs: arrow-key navigation within
 * the group, a single form value, and correct announcement all come for free.
 * The visible tile is the label, so the whole thumbnail is the hit target.
 *
 * Preview URLs are signed on the server — the `photos` bucket is private, so
 * these are short-lived grants for this page view, not durable links.
 */
export function CreativePicker({
  groups,
  value,
  onChange,
}: {
  groups: readonly CreativeGroup[];
  value: string;
  onChange: (assetId: string) => void;
}) {
  if (groups.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-strong px-4 py-6 text-center text-sm text-muted">
        No photos in the library yet. You can save this ad without a creative and
        add one once a shoot has been uploaded.
      </p>
    );
  }

  return (
    <fieldset className="space-y-4">
      <legend className="sr-only">Creative image</legend>

      <div className="flex flex-wrap items-center gap-3">
        <Tile
          assetId=""
          checked={value === ''}
          onSelect={() => onChange('')}
          label="No image"
        >
          <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-faint">
            <ImageOff size={18} aria-hidden="true" />
            <span className="text-[11px]">None</span>
          </span>
        </Tile>
      </div>

      {groups.map((group) => (
        <div key={group.shootTitle} className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            {group.shootTitle}
          </p>
          <div className="flex flex-wrap gap-3">
            {group.choices.map((choice) => (
              <Tile
                key={choice.id}
                assetId={choice.id}
                checked={value === choice.id}
                onSelect={() => onChange(choice.id)}
                label={choice.altText ?? choice.filename}
              >
                {choice.previewUrl ? (
                  <Image
                    src={choice.previewUrl}
                    // Decorative within the picker: the accessible name comes
                    // from the radio's label, so repeating it here would make a
                    // screen reader read every tile twice.
                    alt=""
                    fill
                    sizes="96px"
                    quality={50}
                    className="object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-faint">
                    <ImageOff size={16} aria-hidden="true" />
                  </span>
                )}
              </Tile>
            ))}
          </div>
        </div>
      ))}
    </fieldset>
  );
}

function Tile({
  assetId,
  checked,
  onSelect,
  label,
  children,
}: {
  assetId: string;
  checked: boolean;
  onSelect: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        'relative block h-24 w-24 shrink-0 cursor-pointer overflow-hidden rounded-md border-2 bg-surface-raised transition-colors',
        // The radio itself is visually hidden, so the tile has to carry its
        // focus ring or keyboard users cannot see where they are.
        'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent',
        checked ? 'border-accent' : 'border-subtle hover:border-strong',
      )}
      title={label}
    >
      <input
        type="radio"
        // Not the field the action reads — `ad-form` submits a hidden `assetId`
        // driven by the same state. This one exists so the radio group behaves
        // like a radio group; the value is set anyway so the posted form is
        // coherent rather than carrying a bare "on".
        name="assetIdChoice"
        value={assetId}
        className="sr-only"
        checked={checked}
        onChange={onSelect}
      />
      <span className="sr-only">{label}</span>
      {children}
    </label>
  );
}
