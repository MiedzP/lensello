/**
 * The maths behind the crop tool on the buying page.
 *
 * The crop UI is "fit a box of the product's aspect ratio over the photo,
 * then let the client zoom and pan it" rather than a free-form rectangle —
 * closer to how a phone's own photo picker works, and it means a client can
 * never produce a crop that does not match the print they are ordering.
 * `zoom` shrinks the box below its natural cover-fit size; `panX`/`panY` are
 * fractions of how far the box has been dragged across its available travel,
 * not pixels, so the same crop state means the same thing at any render size.
 */

import type { CropRect } from './resolution';

export interface CropState {
  zoom: number;
  panX: number;
  panY: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export const DEFAULT_CROP: CropState = { zoom: 1, panX: 0.5, panY: 0.5 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * The box's width and height at `zoom === 1` — the largest box of
 * `targetAspect` that fits entirely inside the image, i.e. a cover fit with
 * nothing cropped away on the shorter axis.
 */
export function baseCropSize(
  imageAspect: number,
  targetAspect: number,
): { width: number; height: number } {
  if (imageAspect > targetAspect) {
    return { width: targetAspect / imageAspect, height: 1 };
  }
  return { width: 1, height: imageAspect / targetAspect };
}

/** Turns a zoom/pan state into the normalised 0-1 rect that gets stored and sent to the lab. */
export function deriveCropRect(
  imageWidth: number,
  imageHeight: number,
  targetAspect: number,
  crop: CropState,
): CropRect {
  const imageAspect = imageWidth / imageHeight;
  const base = baseCropSize(imageAspect, targetAspect);
  const zoom = clamp(crop.zoom, MIN_ZOOM, MAX_ZOOM);

  const w = base.width / zoom;
  const h = base.height / zoom;

  const panX = clamp(crop.panX, 0, 1);
  const panY = clamp(crop.panY, 0, 1);

  return {
    x: panX * (1 - w),
    y: panY * (1 - h),
    w,
    h,
  };
}
