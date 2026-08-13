/**
 * Whether a photograph is sharp enough to print at the size a client chose.
 *
 * The lab's `minPixels` is about the file that actually gets sent, and a crop
 * shrinks that file before it ever reaches the lab — a 4000x3000 master
 * cropped down to its centre third is not a 4000x3000 print. Every check here
 * multiplies by the crop fraction first, so the warning is about what will
 * really be printed, not about the original file sitting in the library.
 */

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MinPixels {
  width: number;
  height: number;
}

/** The pixel dimensions that will actually reach the lab, after the crop. */
export function effectivePixels(
  assetWidth: number,
  assetHeight: number,
  crop: CropRect | null,
): { width: number; height: number } {
  if (!crop) return { width: assetWidth, height: assetHeight };
  return {
    width: Math.round(assetWidth * crop.w),
    height: Math.round(assetHeight * crop.h),
  };
}

/**
 * Null means "no warning" — either the lab published no minimum, or the
 * dimensions clear it. Returning the shortfall rather than a boolean lets the
 * UI say something more useful than "too small".
 */
export interface ResolutionWarning {
  effectiveWidth: number;
  effectiveHeight: number;
  minWidth: number;
  minHeight: number;
}

export function checkResolution(input: {
  assetWidth: number | null;
  assetHeight: number | null;
  crop: CropRect | null;
  minPixels: MinPixels | null;
}): ResolutionWarning | null {
  if (!input.minPixels) return null;
  // An asset with no recorded dimensions cannot be judged either way; treat it
  // as unknown rather than as a false failure.
  if (input.assetWidth === null || input.assetHeight === null) return null;

  const { width, height } = effectivePixels(input.assetWidth, input.assetHeight, input.crop);

  if (width >= input.minPixels.width && height >= input.minPixels.height) return null;

  return {
    effectiveWidth: width,
    effectiveHeight: height,
    minWidth: input.minPixels.width,
    minHeight: input.minPixels.height,
  };
}
