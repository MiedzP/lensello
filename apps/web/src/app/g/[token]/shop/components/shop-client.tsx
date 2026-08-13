'use client';

import { useState } from 'react';
import type { GalleryPhoto } from '@/lib/galleries/queries';
import type { ShopCartItem, ShopProduct } from '../page';
import { PhotoPicker } from './photo-picker';
import { Composer } from './composer';
import { Basket } from './basket';

/**
 * Orchestrates the buying flow: pick a photo, then the composer for that
 * photo appears below it with the product, crop and quantity controls. The
 * basket is always visible so adding a second print never means losing track
 * of the first.
 */
export function ShopClient({
  token,
  photos,
  initialAssetId,
  products,
  minPixelsByProductId,
  initialCartItems,
  currency,
}: {
  token: string;
  photos: GalleryPhoto[];
  products: ShopProduct[];
  minPixelsByProductId: Record<string, { width: number; height: number }>;
  initialCartItems: ShopCartItem[];
  initialAssetId: string | null;
  currency: string;
}) {
  // Preselected when the client arrived from a specific photograph in the
  // gallery, so "order this print" lands on that frame rather than dropping
  // them back at the picker to find it again.
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(initialAssetId);
  const selectedPhoto = photos.find((photo) => photo.id === selectedAssetId) ?? null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground">1. Choose a photograph</h2>
          <PhotoPicker photos={photos} selectedId={selectedAssetId} onSelect={setSelectedAssetId} />
        </div>

        {selectedPhoto ? (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-foreground">2. Choose a print</h2>
            <Composer
              token={token}
              photo={selectedPhoto}
              products={products}
              minPixelsByProductId={minPixelsByProductId}
            />
          </div>
        ) : null}
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <Basket token={token} items={initialCartItems} currency={currency} />
      </div>
    </div>
  );
}
