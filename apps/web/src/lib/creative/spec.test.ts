import { describe, expect, it } from 'vitest';
import {
  AD_SIZES,
  charsPerLine,
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
