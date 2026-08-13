import { describe, expect, it } from 'vitest';
import { checkResolution, effectivePixels } from './resolution';

describe('effectivePixels', () => {
  it('returns the asset dimensions unchanged when there is no crop', () => {
    expect(effectivePixels(4000, 3000, null)).toEqual({ width: 4000, height: 3000 });
  });

  it('shrinks by the crop fraction', () => {
    expect(effectivePixels(4000, 3000, { x: 0.25, y: 0, w: 0.5, h: 0.5 })).toEqual({
      width: 2000,
      height: 1500,
    });
  });
});

describe('checkResolution', () => {
  const minPixels = { width: 2000, height: 1600 };

  it('warns when the full asset is already below the minimum', () => {
    const warning = checkResolution({
      assetWidth: 1800,
      assetHeight: 1200,
      crop: null,
      minPixels,
    });
    expect(warning).toEqual({
      effectiveWidth: 1800,
      effectiveHeight: 1200,
      minWidth: 2000,
      minHeight: 1600,
    });
  });

  it('warns when a crop shrinks an otherwise-sufficient asset below the minimum', () => {
    // A 4000x3200 master comfortably clears 2000x1600 uncropped, but a tight
    // crop to a quarter of the frame does not — the warning has to be about
    // what will actually print, not the master file.
    const warning = checkResolution({
      assetWidth: 4000,
      assetHeight: 3200,
      crop: { x: 0.25, y: 0.25, w: 0.4, h: 0.4 },
      minPixels,
    });
    expect(warning).not.toBeNull();
    expect(warning!.effectiveWidth).toBe(1600);
    expect(warning!.effectiveHeight).toBe(1280);
  });

  it('returns null when the effective size clears the minimum', () => {
    expect(
      checkResolution({ assetWidth: 4000, assetHeight: 3200, crop: null, minPixels }),
    ).toBeNull();
  });

  it('returns null when the lab publishes no minimum', () => {
    expect(
      checkResolution({ assetWidth: 100, assetHeight: 100, crop: null, minPixels: null }),
    ).toBeNull();
  });

  it('returns null rather than a false failure when dimensions are unknown', () => {
    expect(
      checkResolution({ assetWidth: null, assetHeight: null, crop: null, minPixels }),
    ).toBeNull();
  });
});
