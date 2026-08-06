import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { renderCreative } from './render';
import { AD_SIZES, type CreativeInput } from './spec';

/**
 * Proves the compositor actually produces a file.
 *
 * Every other adapter in this codebase that talks to something external is
 * unverified, because verifying it needs an account somebody has to create.
 * This one has no such excuse: sharp runs locally, so "it renders" is a claim
 * that can be checked rather than asserted.
 */
async function testPhoto(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 40, g: 90, b: 140 },
    },
  })
    .jpeg()
    .toBuffer();
}

const base: CreativeInput = {
  size: 'instagram_square',
  headline: 'Autumn wedding dates still open',
  subline: 'Full-day coverage across the North West',
  callToAction: 'Check your date',
  studioName: 'Lensello Photography',
  position: 'bottom',
  scrim: 0.55,
};

describe('renderCreative', () => {
  it('produces a real PNG', async () => {
    const out = await renderCreative(await testPhoto(1600, 1200), base);
    const meta = await sharp(out).metadata();

    expect(meta.format).toBe('png');
    expect(out.byteLength).toBeGreaterThan(1000);
  });

  it('produces exactly the pixel dimensions each placement requires', async () => {
    // The whole point of the size picker. An Instagram story that comes out
    // square gets cropped by the platform, and the headline goes with it.
    for (const key of Object.keys(AD_SIZES) as (keyof typeof AD_SIZES)[]) {
      const out = await renderCreative(await testPhoto(1600, 1200), { ...base, size: key });
      const meta = await sharp(out).metadata();

      expect(meta.width).toBe(AD_SIZES[key].width);
      expect(meta.height).toBe(AD_SIZES[key].height);
    }
  });

  it('cover-crops a portrait source into a landscape placement', async () => {
    const out = await renderCreative(await testPhoto(800, 2000), {
      ...base,
      size: 'facebook_feed',
    });
    const meta = await sharp(out).metadata();

    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(630);
  });

  it('survives text that would break the SVG if unescaped', async () => {
    // "Mr & Mrs" is an entirely ordinary headline for a wedding photographer,
    // and a bare ampersand is malformed XML.
    const out = await renderCreative(await testPhoto(1200, 1200), {
      ...base,
      headline: 'Mr & Mrs Smith <2026>',
      subline: `They said "yes"`,
      callToAction: 'Book & enquire',
    });

    expect((await sharp(out).metadata()).format).toBe('png');
  });

  it('renders with every optional field empty', async () => {
    const out = await renderCreative(await testPhoto(1200, 1200), {
      ...base,
      headline: '',
      subline: '',
      callToAction: '',
      studioName: '',
    });

    expect((await sharp(out).metadata()).format).toBe('png');
  });

  it('actually darkens the image when the scrim is raised', async () => {
    // Proves the overlay composites rather than silently doing nothing — the
    // failure mode that would leave unreadable white text on a bright photo.
    const plain = await renderCreative(await testPhoto(1200, 1200), { ...base, scrim: 0 });
    const dark = await renderCreative(await testPhoto(1200, 1200), { ...base, scrim: 0.9 });

    // Sample the bottom strip, where the gradient is strongest.
    const bottom = (buffer: Buffer) =>
      sharp(buffer)
        .extract({ left: 0, top: 1100, width: 1200, height: 100 })
        .stats();

    const plainMean = (await bottom(plain)).channels[0]!.mean;
    const darkMean = (await bottom(dark)).channels[0]!.mean;

    expect(darkMean).toBeLessThan(plainMean);
  });
});
