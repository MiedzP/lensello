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
 * composited on top. Every position comes from `composeBlock`, which the CSS
 * preview also uses, so what is designed is what is exported.
 */

import sharp from 'sharp';
import { composeBlock, escapeXml, layoutFor, type CreativeInput } from './spec';

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
  const block = composeBlock(input);
  const { width, height } = layout;

  // Positions come straight from composeBlock. Nothing here computes a
  // coordinate — that is what kept drifting from the preview.
  const headlineTspans = block.headlineLines
    .map(
      (line, index) =>
        `<text x="${block.padPx}" y="${block.headlineBaselines[index]}" class="headline">${escapeXml(line)}</text>`,
    )
    .join('');

  const sublineTspans = block.sublineLines
    .map(
      (line, index) =>
        `<text x="${block.padPx}" y="${block.sublineBaselines[index]}" class="subline">${escapeXml(line)}</text>`,
    )
    .join('');

  const cta = input.callToAction.trim();
  const ctaGroup =
    cta && block.ctaTop !== null
      ? `<rect x="${block.padPx}" y="${block.ctaTop}" width="${block.ctaWidth}" height="${block.ctaHeight}" rx="${block.ctaHeight / 2}" fill="#ffffff"/>
       <text x="${block.padPx + block.ctaWidth / 2}" y="${block.ctaTop + block.ctaHeight / 2 + block.ctaPx * 0.36}" class="cta">${escapeXml(cta)}</text>`
      : '';

  const studio = input.studioName.trim();
  const studioGroup = studio
    ? `<text x="${block.padPx}" y="${block.studioBaseline}" class="studio">${escapeXml(studio)}</text>`
    : '';

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="scrim" x1="0" y1="${block.scrimStart}" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="${layout.scrimOpacity}"/>
    </linearGradient>
    <style>
      .headline { fill: #ffffff; font-size: ${block.headlinePx}px; font-weight: 700;
                  font-family: 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif;
                  letter-spacing: -0.5px; }
      .subline  { fill: #f2f2f2; font-size: ${block.sublinePx}px; font-weight: 400;
                  font-family: 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif; }
      .cta      { fill: #111111; font-size: ${block.ctaPx}px; font-weight: 600; text-anchor: middle;
                  font-family: 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif; }
      .studio   { fill: #ffffff; font-size: ${block.studioPx}px; font-weight: 600;
                  letter-spacing: 2px;
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
