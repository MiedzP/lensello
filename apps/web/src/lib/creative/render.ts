/**
 * Rendering an ad creative to a real PNG.
 *
 * sharp on the server rather than a canvas in the browser, for one blunt
 * reason: the photographs live in a private bucket behind signed URLs, and
 * drawing a cross-origin image onto a canvas taints it — `toBlob` then throws
 * and the export silently stops working. Fetching the bytes server-side has no
 * such problem, and it also keeps the original file out of the browser at full
 * resolution.
 *
 * The photograph is cover-cropped to the target aspect, then an SVG overlay is
 * composited on top. The overlay is generated from the same `layoutFor` the CSS
 * preview uses, so what is designed is what is exported.
 */

import sharp from 'sharp';
import {
  charsPerLine,
  escapeXml,
  layoutFor,
  wrapText,
  type CreativeInput,
} from './spec';

const HEADLINE_LINES = 3;
const SUBLINE_LINES = 2;

/**
 * The text overlay, as SVG.
 *
 * System font stack rather than a bundled webfont: sharp renders text through
 * the host's fontconfig, and a font that is not installed silently falls back
 * to something else. Naming a stack that exists on the platform is more honest
 * than shipping a file that may or may not be picked up.
 */
function overlaySvg(input: CreativeInput): string {
  const layout = layoutFor(input);
  const { width, height } = layout;

  const padPx = layout.padding * height;
  const headlinePx = layout.headlineSize * height;
  const sublinePx = layout.sublineSize * height;
  const ctaPx = layout.ctaSize * height;
  const studioPx = layout.studioSize * height;

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

  let y = layout.blockTop * height + headlinePx;

  const headlineTspans = headlineLines
    .map((line, index) => {
      const lineY = y + index * headlinePx * 1.12;
      return `<text x="${padPx}" y="${lineY}" class="headline">${escapeXml(line)}</text>`;
    })
    .join('');

  y += headlineLines.length * headlinePx * 1.12;

  const sublineTspans = sublineLines
    .map((line, index) => {
      const lineY = y + sublinePx * 0.4 + index * sublinePx * 1.3;
      return `<text x="${padPx}" y="${lineY}" class="subline">${escapeXml(line)}</text>`;
    })
    .join('');

  y += sublineLines.length * sublinePx * 1.3 + sublinePx * 0.4;

  const cta = input.callToAction.trim();
  const ctaPadX = ctaPx * 0.9;
  const ctaPadY = ctaPx * 0.6;
  // Estimated, like the wrapping. The pill is sized generously so text never
  // sits flush against the edge.
  const ctaWidth = cta.length * ctaPx * 0.58 + ctaPadX * 2;
  const ctaHeight = ctaPx + ctaPadY * 2;
  const ctaY = y + ctaPx * 0.8;

  const ctaGroup = cta
    ? `<rect x="${padPx}" y="${ctaY}" width="${ctaWidth}" height="${ctaHeight}" rx="${ctaHeight / 2}" fill="#ffffff"/>
       <text x="${padPx + ctaWidth / 2}" y="${ctaY + ctaHeight / 2 + ctaPx * 0.36}" class="cta">${escapeXml(cta)}</text>`
    : '';

  const studio = input.studioName.trim();
  const studioGroup = studio
    ? `<text x="${padPx}" y="${padPx + studioPx}" class="studio">${escapeXml(studio)}</text>`
    : '';

  const scrimStart = Math.max(0, layout.blockTop - 0.18);

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="scrim" x1="0" y1="${scrimStart}" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="${layout.scrimOpacity}"/>
    </linearGradient>
    <style>
      .headline { fill: #ffffff; font-size: ${headlinePx}px; font-weight: 700;
                  font-family: 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif;
                  letter-spacing: -0.5px; }
      .subline  { fill: #f2f2f2; font-size: ${sublinePx}px; font-weight: 400;
                  font-family: 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif; }
      .cta      { fill: #111111; font-size: ${ctaPx}px; font-weight: 600; text-anchor: middle;
                  font-family: 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif; }
      .studio   { fill: #ffffff; font-size: ${studioPx}px; font-weight: 600;
                  letter-spacing: 2px; text-transform: uppercase;
                  font-family: 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    </style>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#scrim)"/>
  ${studioGroup}
  ${headlineTspans}
  ${sublineTspans}
  ${ctaGroup}
</svg>`;
}

/**
 * Composites the creative and returns PNG bytes.
 *
 * `fit: 'cover'` with centre gravity: an ad has a fixed aspect and the
 * photograph almost never matches it, so something has to give. Cropping keeps
 * the subject at full bleed; letterboxing would put bars in a paid placement.
 */
export async function renderCreative(
  photo: Buffer,
  input: CreativeInput,
): Promise<Buffer> {
  const layout = layoutFor(input);

  const base = await sharp(photo)
    .rotate() // Honours EXIF orientation, or phone shots come out sideways.
    .resize(layout.width, layout.height, { fit: 'cover', position: 'centre' })
    .toBuffer();

  return sharp(base)
    .composite([{ input: Buffer.from(overlaySvg(input)), top: 0, left: 0 }])
    .png()
    .toBuffer();
}
