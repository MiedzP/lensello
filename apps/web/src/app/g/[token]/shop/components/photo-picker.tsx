'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { GalleryPhoto } from '@/lib/galleries/queries';

export function PhotoPicker({
  photos,
  selectedId,
  onSelect,
}: {
  photos: GalleryPhoto[];
  selectedId: string | null;
  onSelect: (assetId: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
      {photos.map((photo) => {
        const isSelected = photo.id === selectedId;
        return (
          <button
            key={photo.id}
            type="button"
            onClick={() => onSelect(photo.id)}
            aria-pressed={isSelected}
            className={cn(
              'relative aspect-square overflow-hidden rounded-md ring-2 transition-all',
              isSelected ? 'ring-accent' : 'ring-transparent hover:ring-strong',
            )}
          >
            <Image
              src={photo.url}
              alt={photo.altText ?? ''}
              fill
              sizes="200px"
              className="object-cover"
            />
          </button>
        );
      })}
    </div>
  );
}
