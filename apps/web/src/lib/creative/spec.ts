/**
 * The layout of an ad creative, as pure geometry.
 *
 * Two things render this: a CSS preview in the browser, and sharp on the
 * server. They must agree, or you design one thing and export another — so
 * every position and size here is a **fraction of the canvas**, computed once
 * and consumed by both. Nothing in this file knows about pixels, DOM, or
 * image encoding.
 *
 * Fractions rather than pixels is what makes one design work at 1080×1080 and
 * 1080×1920 without a second set of numbers to keep in step.
 */

export const AD_SIZES = {
  instagram_square: { label: 'Instagram square', width: 1080, height: 1080 },
  instagram_portrait: { label: 'Instagram portrait', width: 1080, height: 1350 },
  instagram_story: { label: 'Instagram story', width: 1080, height: 1920 },
  facebook_feed: { label: 'Facebook feed', width: 1200, height: 630 },
  // IAB standard display sizes. The fitting loop is what makes these usable —
  // type scaled off a 250px short edge would otherwise overflow the canvas.
  display_rectangle: { label: 'Display rectangle', width: 300, height: 250 },
  display_leaderboard: { label: 'Leaderboard', width: 728, height: 90 },
  display_half_page: { label: 'Half page', width: 300, height: 600 },
  display_billboard: { label: 'Billboard', width: 970, height: 250 },
} as const;

export type AdSizeKey = keyof typeof AD_SIZES;

export const AD_SIZE_KEYS = Object.keys(AD_SIZES) as AdSizeKey[];

export type TextPosition = 'bottom' | 'centre';

export const CUSTOM_SIZE = 'custom';

/**
 * Guard rails on a hand-entered canvas. Below this, text is unreadable at any
 * type scale; above it, sharp composites megapixels nobody asked for.
 */
// 50 because 320x50 and 728x90 are standard banner formats. A higher floor
// silently clamped them to something else and rendered a canvas nobody asked
// for, which is worse than refusing outright.
export const MIN_DIMENSION = 50;
export const MAX_DIMENSION = 4000;

export interface CreativeInput {
  size: AdSizeKey | typeof CUSTOM_SIZE;
  /** Used only when `size` is 'custom'. */
  customWidth?: number;
  customHeight?: number;
  headline: string;
  subline: string;
  callToAction: string;
  studioName: string;
  position: TextPosition;
  /** 0–1. How dark the scrim behind the text is. */
  scrim: number;
}

export interface CreativeLayout {
  width: number;
  height: number;
  /** Fractions of the canvas, so CSS and sharp derive identical pixels. */
  padding: number;
  headlineSize: number;
  sublineSize: number;
  ctaSize: number;
  studioSize: number;
  scrimOpacity: number;
  /** Where the text block starts, as a fraction of height from the top. */
  blockTop: number;
  position: TextPosition;
}

/**
 * Type scale, relative to the *shorter* edge.
 *
 * Relative to height would make a story's headline enormous and a Facebook
 * banner's tiny; the short edge is what the eye actually judges text size
 * against on a phone.
 */
function clampDimension(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, Math.round(value)));
}

/** The canvas, from a preset or from hand-entered numbers. */
export function dimensionsFor(input: CreativeInput): { width: number; height: number } {
  if (input.size === CUSTOM_SIZE) {
    return {
      width: clampDimension(input.customWidth, 1080),
      height: clampDimension(input.customHeight, 1080),
    };
  }
  // Destructured, not returned wholesale: the preset carries a `label` the
  // declared type does not admit to, and it would ride along into anything
  // that spread this.
  const { width, height } = AD_SIZES[input.size];
  return { width, height };
}

export function layoutFor(input: CreativeInput): CreativeLayout {
  const { width, height } = dimensionsFor(input);
  const short = Math.min(width, height);

  return {
    width,
    height,
    padding: (short * 0.075) / height,
    headlineSize: (short * 0.082) / height,
    sublineSize: (short * 0.042) / height,
    ctaSize: (short * 0.038) / height,
    studioSize: (short * 0.032) / height,
    scrimOpacity: Math.min(0.9, Math.max(0, input.scrim)),
    blockTop: input.position === 'centre' ? 0.38 : 0.58,
    position: input.position,
  };
}

/**
 * Greedy line wrapping against an estimated character width.
 *
 * Approximate on purpose: measuring real glyph widths would mean shipping font
 * metrics to both renderers, and the headline is a handful of words. The
 * estimate is deliberately generous so text breaks early rather than
 * overflowing the canvas — a wrapped line looks intentional, a clipped one
 * looks broken.
 */
export function wrapText(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }

  if (current && lines.length < maxLines) lines.push(current);

  // Anything past the limit is dropped with an ellipsis on the last kept line,
  // rather than silently vanishing.
  if (lines.length === maxLines) {
    const consumed = lines.join(' ').split(/\s+/).length;
    if (consumed < words.length) {
      const last = lines[maxLines - 1]!;
      lines[maxLines - 1] = `${last.replace(/[,.;:]$/, '')}…`;
    }
  }

  return lines;
}

/** Characters that fit on a line at a given font size, estimated. */
export function charsPerLine(canvasWidth: number, fontSizePx: number, padding: number): number {
  const usable = canvasWidth - padding * 2;
  // 0.52em is a reasonable average advance for a humanist sans at display size.
  return Math.max(8, Math.floor(usable / (fontSizePx * 0.52)));
}

export interface ComposedBlock {
  headlineLines: string[];
  sublineLines: string[];
  /** Absolute y of each text baseline, in canvas pixels. */
  headlineBaselines: number[];
  sublineBaselines: number[];
  /** Absolute top-left of the call-to-action pill. Null when there is none. */
  ctaTop: number | null;
  studioBaseline: number;
  padPx: number;
  headlinePx: number;
  sublinePx: number;
  ctaPx: number;
  studioPx: number;
  ctaWidth: number;
  ctaHeight: number;
  blockHeight: number;
  blockTopPx: number;
  scrimStart: number;
}

const HEADLINE_LINE_HEIGHT = 1.12;
const SUBLINE_LINE_HEIGHT = 1.3;
const HEADLINE_LINES = 3;
const SUBLINE_LINES = 2;

/**
 * Lays the text block out at a given type scale and returns finished
 * coordinates.
 *
 * Callers consume positions; they do not compute them. That is the whole point
 * of this function existing. When the renderer and the measurer each did their
 * own arithmetic they drifted twice in a row — first the call-to-action fell
 * off the bottom of the canvas, then the supporting line landed on top of the
 * headline. Neither raised an error; both were only visible by looking at the
 * exported PNG.
 *
 * Laid out from zero, measured, then offset — so the anchoring rule lives in
 * one place and the geometry above it never has to know about it.
 */
function composeAt(input: CreativeInput, typeScale: number): ComposedBlock {
  const layout = layoutFor(input);
  const { width, height } = layout;

  const padPx = layout.padding * height;
  const headlinePx = layout.headlineSize * height * typeScale;
  const sublinePx = layout.sublineSize * height * typeScale;
  const ctaPx = layout.ctaSize * height * typeScale;
  const studioPx = layout.studioSize * height * typeScale;

  const headlineLines = wrapText(
    input.headline,
    charsPerLine(width, headlinePx, padPx),
    HEADLINE_LINES,
  );
  const sublineLines = wrapText(
    input.subline,
    charsPerLine(width, sublinePx, padPx),
    SUBLINE_LINES,
  );

  const cta = input.callToAction.trim();
  const ctaHeight = cta ? ctaPx * 2.2 : 0;
  const ctaWidth = cta ? cta.length * ctaPx * 0.58 + ctaPx * 1.8 : 0;

  // --- pass one: lay out from zero -----------------------------------------
  let cursor = 0;

  const headlineBaselines = headlineLines.map((_, index) => {
    // Text is baseline-positioned, so the first baseline sits an ascender below
    // the top edge. One font-size is a generous stand-in for the ascender.
    if (index === 0) return cursor + headlinePx;
    return cursor + headlinePx + index * headlinePx * HEADLINE_LINE_HEIGHT;
  });

  if (headlineLines.length > 0) {
    // Past the last baseline, plus room for its descenders — without this the
    // next element sits on top of the line above.
    cursor =
      headlineBaselines[headlineBaselines.length - 1]! + headlinePx * 0.28;
  }

  const sublineBaselines = sublineLines.map((_, index) => {
    const first = cursor + sublinePx;
    return first + index * sublinePx * SUBLINE_LINE_HEIGHT;
  });

  if (sublineLines.length > 0) {
    cursor = sublineBaselines[sublineBaselines.length - 1]! + sublinePx * 0.3;
  }

  const ctaTopRelative = cta ? cursor + ctaPx * 0.6 : null;
  if (ctaTopRelative !== null) cursor = ctaTopRelative + ctaHeight;

  const blockHeight = cursor;

  // --- pass two: anchor and offset -----------------------------------------
  const blockTopPx =
    input.position === 'centre'
      ? Math.max(padPx, (height - blockHeight) / 2)
      : Math.max(padPx, height - padPx - blockHeight);

  return {
    headlineLines,
    sublineLines,
    headlineBaselines: headlineBaselines.map((y) => y + blockTopPx),
    sublineBaselines: sublineBaselines.map((y) => y + blockTopPx),
    ctaTop: ctaTopRelative === null ? null : ctaTopRelative + blockTopPx,
    studioBaseline: padPx + studioPx,
    padPx,
    headlinePx,
    sublinePx,
    ctaPx,
    studioPx,
    ctaWidth,
    ctaHeight,
    blockHeight,
    blockTopPx,
    scrimStart: Math.max(0, blockTopPx / height - 0.18),
  };
}

export { HEADLINE_LINE_HEIGHT, SUBLINE_LINE_HEIGHT };

/** Escapes text for embedding in SVG. Unescaped `&` alone breaks the render. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Lays the block out, shrinking the type until it fits the canvas.
 *
 * The type scale is derived from the short edge, which is right for the square
 * and portrait presets but falls apart on a shape the presets never covered —
 * a 970x250 banner has a short edge of 250, so a headline sized off it plus a
 * subline plus a pill is taller than the canvas. Before custom dimensions
 * existed that could not happen; now it can, and the block would simply run off
 * the bottom, which is the exact bug the bottom-anchoring fixed once already.
 *
 * So the block is measured and, if it overflows, re-laid at a smaller scale.
 * Iterated rather than solved in one step because wrapping changes with the
 * type size: smaller text fits more words per line, which can remove a line
 * entirely and change the height non-linearly.
 */
export function composeBlock(input: CreativeInput): ComposedBlock {
  const { height } = dimensionsFor(input);

  let scale = 1;
  let block = composeAt(input, scale);

  for (let attempt = 0; attempt < 4; attempt++) {
    const available = height - block.padPx * 2;
    if (block.blockHeight <= available) break;

    // Overshoot slightly so a borderline fit does not need another pass.
    scale *= Math.max(0.35, (available / block.blockHeight) * 0.95);
    block = composeAt(input, scale);
  }

  return block;
}
