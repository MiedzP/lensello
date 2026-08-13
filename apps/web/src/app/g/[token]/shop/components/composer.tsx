'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertTriangle, ShoppingBag } from 'lucide-react';
import { Button, ErrorNote } from '@/components/ui';
import { DEFAULT_CROP, deriveCropRect, type CropState } from '@/lib/prints/crop-math';
import { checkResolution } from '@/lib/prints/resolution';
import { formatMinorUnits } from '@/lib/prints/money';
import type { GalleryPhoto } from '@/lib/galleries/queries';
import { addToBasket } from '../actions';
import { SHOP_IDLE } from '../shop-state';
import type { ShopProduct } from '../page';
import { ProductPicker } from './product-picker';
import { CropStage } from './crop-stage';

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" disabled={pending} className="w-full">
      <ShoppingBag size={16} aria-hidden="true" />
      {pending ? 'Adding…' : 'Add to basket'}
    </Button>
  );
}

export function Composer({
  token,
  photo,
  products,
  minPixelsByProductId,
}: {
  token: string;
  photo: GalleryPhoto;
  products: ShopProduct[];
  minPixelsByProductId: Record<string, { width: number; height: number }>;
}) {
  const [productId, setProductId] = useState<string | null>(products[0]?.id ?? null);
  const [crop, setCrop] = useState<CropState>(DEFAULT_CROP);
  const [quantity, setQuantity] = useState(1);
  const [state, formAction] = useActionState(addToBasket, SHOP_IDLE);

  const product = products.find((candidate) => candidate.id === productId) ?? null;

  const targetAspect = product?.width_mm && product?.height_mm ? product.width_mm / product.height_mm : 1;

  const cropRect = useMemo(
    () => (photo.width && photo.height ? deriveCropRect(photo.width, photo.height, targetAspect, crop) : null),
    [photo.width, photo.height, targetAspect, crop],
  );

  const warning =
    product && !product.is_digital
      ? checkResolution({
          assetWidth: photo.width,
          assetHeight: photo.height,
          crop: cropRect,
          minPixels: minPixelsByProductId[product.id] ?? null,
        })
      : null;

  if (!product) return null;

  return (
    <div className="space-y-5 rounded-xl border border-subtle bg-surface p-4 sm:p-5">
      <ProductPicker products={products} selectedId={productId} onSelect={setProductId} />

      {product.is_digital ? (
        <div className="overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed preview URL. */}
          <img src={photo.url} alt="" className="max-h-[55vh] w-full object-contain" />
        </div>
      ) : photo.width && photo.height ? (
        <CropStage
          imageUrl={photo.url}
          imageWidth={photo.width}
          imageHeight={photo.height}
          targetAspect={targetAspect}
          crop={crop}
          onChange={setCrop}
        />
      ) : (
        <p className="text-sm text-muted">This photograph has no recorded dimensions, so it cannot be cropped here.</p>
      )}

      {warning ? (
        <div className="flex gap-2 rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-sm text-warning">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            This photo is {warning.effectiveWidth}×{warning.effectiveHeight}px at this crop, below the{' '}
            {warning.minWidth}×{warning.minHeight}px the lab recommends for {product.size_label ?? product.name}. It
            can still be printed, but it may look soft.
          </span>
        </div>
      ) : null}

      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      {state.message ? (
        <p className="rounded-md border border-success/30 bg-success-subtle px-3 py-2 text-sm text-success">
          {state.message}
        </p>
      ) : null}

      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="productId" value={product.id} />
        <input type="hidden" name="assetId" value={photo.id} />
        <input type="hidden" name="crop" value={product.is_digital || !cropRect ? '' : JSON.stringify(cropRect)} />

        <label className="flex items-center gap-2 text-sm text-foreground">
          Qty
          <input
            type="number"
            name="quantity"
            min={1}
            max={99}
            value={quantity}
            onChange={(event) => setQuantity(Math.min(Math.max(Number(event.target.value) || 1, 1), 99))}
            className="h-9 w-16 rounded-md border border-strong bg-surface px-2 text-center text-sm"
          />
        </label>

        <div className="flex-1" />

        <div className="text-right">
          <div className="text-xs text-faint">Line total</div>
          <div className="text-lg font-semibold tabular-nums text-foreground">
            {formatMinorUnits(product.price * quantity, product.currency)}
          </div>
        </div>

        <div className="w-full sm:w-auto">
          <AddButton />
        </div>
      </form>
    </div>
  );
}
