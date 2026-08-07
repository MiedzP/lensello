import { describe, expect, it } from 'vitest';
import {
  AD_SIZES,
  CUSTOM_SIZE,
  MAX_DIMENSION,
  MIN_DIMENSION,
  charsPerLine,
  composeBlock,
  dimensionsFor,
  escapeXml,
  layoutFor,
  wrapText,
  type CreativeInput,
} from './spec';

const base: CreativeInput = {
  size: 'instagram_square',
  headline: 'Autumn wedding dates still open',
  subline: 'Full-day coverage across the North West',
  callToAction: 'Check your date',
  studioName: 'Lensello Photography',
  position: 'bottom',
  scrim: 0.55,
};

/**
 * A CSS preview and a sharp render both consume this. If the two disagree the
 * photographer designs one thing and exports another, and there is no error to
 * notice — the file is just wrong.
 */
describe('layoutFor', () => {
  it('returns the exact pixel dimensions for each platform size', () => {
    for (const key of Object.keys(AD_SIZES) as (keyof typeof AD_SIZES)[]) {
      const layout = layoutFor({ ...base, size: key });
      expect(layout.width).toBe(AD_SIZES[key].width);
      expect(layout.height).toBe(AD_SIZES[key].height);
    }
  });

  it('scales type off the short edge, not the height', () => {
    // Off height, a story headline would be enormous and a Facebook banner's
    // unreadably small. The short edge is what the eye judges against.
    const square = layoutFor({ ...base, size: 'instagram_square' });
    const story = layoutFor({ ...base, size: 'instagram_story' });

    const squarePx = square.headlineSize * square.height;
    const storyPx = story.headlineSize * story.height;
    expect(Math.round(squarePx)).toBe(Math.round(storyPx));
  });

  it('moves the text block up when centred', () => {
    expect(layoutFor({ ...base, position: 'centre' }).blockTop).toBeLessThan(
      layoutFor({ ...base, position: 'bottom' }).blockTop,
    );
  });

  it('clamps the scrim into a usable range', () => {
    expect(layoutFor({ ...base, scrim: 5 }).scrimOpacity).toBe(0.9);
    expect(layoutFor({ ...base, scrim: -1 }).scrimOpacity).toBe(0);
  });
});

describe('wrapText', () => {
  it('breaks on words, never mid-word', () => {
    const lines = wrapText('Autumn wedding dates still open', 12, 3);
    expect(lines.every((line) => !line.endsWith('-'))).toBe(true);
    expect(lines.join(' ').replace('…', '')).toContain('Autumn');
  });

  it('respects the line limit', () => {
    const lines = wrapText('one two three four five six seven eight nine ten', 8, 2);
    expect(lines).toHaveLength(2);
  });

  it('marks truncation rather than silently dropping words', () => {
    // Text that quietly vanishes is worse than text that shows it was cut:
    // one is a design decision, the other is a bug you never see.
    const lines = wrapText('one two three four five six seven eight nine ten', 8, 2);
    expect(lines[1]).toContain('…');
  });

  it('does not add an ellipsis when everything fits', () => {
    const lines = wrapText('Short headline', 40, 3);
    expect(lines).toEqual(['Short headline']);
  });

  it('handles empty and whitespace-only input', () => {
    expect(wrapText('', 20, 3)).toEqual([]);
    expect(wrapText('   ', 20, 3)).toEqual([]);
  });

  it('keeps a single word longer than the line rather than losing it', () => {
    expect(wrapText('Extraordinarily', 5, 2)).toEqual(['Extraordinarily']);
  });
});

describe('charsPerLine', () => {
  it('fits fewer characters as the type grows', () => {
    expect(charsPerLine(1080, 120, 80)).toBeLessThan(charsPerLine(1080, 60, 80));
  });

  it('never returns something unusably small', () => {
    expect(charsPerLine(300, 400, 140)).toBeGreaterThanOrEqual(8);
  });
});

describe('escapeXml', () => {
  it('escapes the characters that would break an SVG render', () => {
    // A bare ampersand in a headline makes sharp fail on malformed XML, which
    // surfaces as "the export is broken" rather than "your text has an &".
    expect(escapeXml('Mr & Mrs')).toBe('Mr &amp; Mrs');
    expect(escapeXml('<b>')).toBe('&lt;b&gt;');
    expect(escapeXml(`"quoted" 'single'`)).toBe('&quot;quoted&quot; &apos;single&apos;');
  });

  it('escapes the ampersand first, so escapes are not double-escaped', () => {
    expect(escapeXml('a & <b>')).toBe('a &amp; &lt;b&gt;');
  });
});

describe('composeBlock', () => {
  /**
   * The regression this exists for: the block used to be anchored from a fixed
   * fraction of the height, so a two-line headline over a two-line subline
   * pushed the call-to-action pill past the bottom edge. Nothing errored — the
   * button was simply absent from the exported file, and only looking at the
   * PNG showed it.
   */
  it('keeps the whole block on the canvas at its tallest', () => {
    for (const key of Object.keys(AD_SIZES) as (keyof typeof AD_SIZES)[]) {
      const block = composeBlock({
        ...base,
        size: key,
        headline: 'A headline long enough to wrap onto three separate lines here',
        subline: 'And a supporting line that also wraps across two full lines of text',
        callToAction: 'Check your date',
      });

      const bottom = block.blockTopPx + block.blockHeight;
      expect(bottom).toBeLessThanOrEqual(AD_SIZES[key].height + 0.5);
      expect(block.blockTopPx).toBeGreaterThanOrEqual(0);
    }
  });

  it('sits the block against the bottom margin when anchored bottom', () => {
    const block = composeBlock({ ...base, size: 'instagram_square' });
    const bottom = block.blockTopPx + block.blockHeight;
    expect(bottom).toBeCloseTo(AD_SIZES.instagram_square.height - block.padPx, 0);
  });

  it('centres the block vertically when asked', () => {
    const block = composeBlock({ ...base, position: 'centre' });
    const above = block.blockTopPx;
    const below = AD_SIZES.instagram_square.height - (block.blockTopPx + block.blockHeight);
    expect(Math.abs(above - below)).toBeLessThan(1);
  });

  it('reclaims the space when there is no call to action', () => {
    const withCta = composeBlock({ ...base, callToAction: 'Check your date' });
    const without = composeBlock({ ...base, callToAction: '' });
    expect(without.blockHeight).toBeLessThan(withCta.blockHeight);
    expect(without.ctaHeight).toBe(0);
  });
});

describe('custom dimensions', () => {
  it('uses hand-entered numbers', () => {
    expect(
      dimensionsFor({ ...base, size: CUSTOM_SIZE, customWidth: 970, customHeight: 250 }),
    ).toEqual({ width: 970, height: 250 });
  });

  it('clamps absurd values rather than trying to render them', () => {
    expect(
      dimensionsFor({ ...base, size: CUSTOM_SIZE, customWidth: 99999, customHeight: 10 }),
    ).toEqual({ width: MAX_DIMENSION, height: MIN_DIMENSION });
  });

  it('falls back to square when the numbers are missing or nonsense', () => {
    expect(dimensionsFor({ ...base, size: CUSTOM_SIZE })).toEqual({ width: 1080, height: 1080 });
    expect(
      dimensionsFor({ ...base, size: CUSTOM_SIZE, customWidth: NaN, customHeight: NaN }),
    ).toEqual({ width: 1080, height: 1080 });
  });

  it('rounds fractional pixels', () => {
    expect(
      dimensionsFor({ ...base, size: CUSTOM_SIZE, customWidth: 800.6, customHeight: 400.2 }),
    ).toEqual({ width: 801, height: 400 });
  });

  it('still honours the presets', () => {
    for (const key of Object.keys(AD_SIZES) as (keyof typeof AD_SIZES)[]) {
      expect(dimensionsFor({ ...base, size: key })).toEqual({
        width: AD_SIZES[key].width,
        height: AD_SIZES[key].height,
      });
    }
  });
});

describe('fitting the block to an arbitrary canvas', () => {
  /**
   * The reason custom sizes needed the fitting loop: type is scaled off the
   * short edge, so on a wide banner a headline plus subline plus pill is taller
   * than the whole canvas. It would have run off the bottom exactly as it did
   * before bottom-anchoring — silently, with no error.
   */
  const shapes = [
    { w: 970, h: 250, name: 'billboard banner' },
    { w: 728, h: 90, name: 'leaderboard' },
    { w: 300, h: 600, name: 'half page' },
    { w: 320, h: 50, name: 'mobile banner' },
    { w: 4000, h: 4000, name: 'oversized square' },
    { w: 200, h: 200, name: 'smallest allowed' },
  ];

  for (const { w, h, name } of shapes) {
    it(`keeps the block on the canvas: ${name} (${w}x${h})`, () => {
      const block = composeBlock({
        ...base,
        size: CUSTOM_SIZE,
        customWidth: w,
        customHeight: h,
        headline: 'Autumn wedding dates still open across the North West',
        subline: 'Full-day coverage, two photographers, albums included',
        callToAction: 'Check your date',
      });

      expect(block.blockTopPx).toBeGreaterThanOrEqual(0);
      expect(block.blockTopPx + block.blockHeight).toBeLessThanOrEqual(h + 0.5);
    });
  }

  it('leaves a comfortable canvas at full size', () => {
    // The fitting loop must not shrink type that already fits, or every
    // ordinary square ad would come out smaller than designed.
    const square = composeBlock({ ...base, size: 'instagram_square' });
    const expected = layoutFor({ ...base, size: 'instagram_square' });
    expect(square.headlinePx).toBeCloseTo(expected.headlineSize * expected.height, 5);
  });
});
