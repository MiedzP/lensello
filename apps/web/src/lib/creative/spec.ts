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
} as const;

export type AdSizeKey = keyof typeof AD_SIZES;

export const AD_SIZE_KEYS = Object.keys(AD_SIZES) as AdSizeKey[];

export type TextPosition = 'bottom' | 'centre';

export interface CreativeInput {
  size: AdSizeKey;
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
export function layoutFor(input: CreativeInput): CreativeLayout {
  const { width, height } = AD_SIZES[input.size];
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

/** Escapes text for embedding in SVG. Unescaped `&` alone breaks the render. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
