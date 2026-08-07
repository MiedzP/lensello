'use server';

/**
 * Rendering and saving ad creative.
 *
 * Both actions go through the caller's session, so RLS applies and a staff
 * member can only composite photographs the studio actually holds.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import {
  AD_SIZE_KEYS,
  CUSTOM_SIZE,
  MAX_DIMENSION,
  MIN_DIMENSION,
  type CreativeInput,
} from '@/lib/creative/spec';
import { renderCreative } from '@/lib/creative/render';
import type { CreativeState } from './creative-state';
import { CREATIVE_IDLE } from './creative-state';

const schema = z.object({
  assetId: z.string().uuid('Pick a photograph.'),
  size: z.enum([CUSTOM_SIZE, ...AD_SIZE_KEYS] as [string, ...string[]]),
  // Bounded here as well as in `dimensionsFor`. The clamp there keeps a render
  // sane; this tells the person what they typed was out of range instead of
  // quietly producing a different canvas.
  customWidth: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? Number(value) : undefined))
    .refine(
      (value) =>
        value === undefined ||
        (Number.isFinite(value) && value >= MIN_DIMENSION && value <= MAX_DIMENSION),
      `Width must be between ${MIN_DIMENSION} and ${MAX_DIMENSION} pixels.`,
    ),
  customHeight: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? Number(value) : undefined))
    .refine(
      (value) =>
        value === undefined ||
        (Number.isFinite(value) && value >= MIN_DIMENSION && value <= MAX_DIMENSION),
      `Height must be between ${MIN_DIMENSION} and ${MAX_DIMENSION} pixels.`,
    ),
  headline: z.string().trim().max(120),
  subline: z.string().trim().max(160),
  callToAction: z.string().trim().max(40),
  studioName: z.string().trim().max(60),
  position: z.enum(['bottom', 'centre']),
  scrim: z
    .string()
    .trim()
    .transform((value) => Number(value))
    .refine((value) => Number.isFinite(value) && value >= 0 && value <= 1, 'Bad scrim.'),
  save: z.string().optional(),
});

function parse(formData: FormData) {
  return schema.safeParse({
    assetId: formData.get('assetId'),
    size: formData.get('size'),
    customWidth: formData.get('customWidth') ?? undefined,
    customHeight: formData.get('customHeight') ?? undefined,
    headline: formData.get('headline') ?? '',
    subline: formData.get('subline') ?? '',
    callToAction: formData.get('callToAction') ?? '',
    studioName: formData.get('studioName') ?? '',
    position: formData.get('position') ?? 'bottom',
    scrim: formData.get('scrim') ?? '0.55',
    save: formData.get('save') ?? undefined,
  });
}

export async function renderAdCreative(
  _previous: CreativeState,
  formData: FormData,
): Promise<CreativeState> {
  const { supabase } = await requireUser();

  const parsed = parse(formData);
  if (!parsed.success) {
    return { ...CREATIVE_IDLE, error: parsed.error.issues[0]?.message ?? 'Check the form.' };
  }

  const input = parsed.data;

  const { data: asset } = await supabase
    .from('assets')
    .select('id, shoot_id, storage_path, filename')
    .eq('id', input.assetId)
    .maybeSingle();

  if (!asset) return { ...CREATIVE_IDLE, error: 'That photograph no longer exists.' };

  const { data: file, error: downloadError } = await supabase.storage
    .from('photos')
    .download(asset.storage_path);

  if (downloadError || !file) {
    return { ...CREATIVE_IDLE, error: 'That photograph could not be fetched.' };
  }

  const spec: CreativeInput = {
    size: input.size as CreativeInput['size'],
    customWidth: input.customWidth,
    customHeight: input.customHeight,
    headline: input.headline,
    subline: input.subline,
    callToAction: input.callToAction,
    studioName: input.studioName,
    position: input.position,
    scrim: input.scrim,
  };

  let png: Buffer;
  try {
    png = await renderCreative(Buffer.from(await file.arrayBuffer()), spec);
  } catch (cause) {
    console.error('[creative] render failed', cause);
    return {
      ...CREATIVE_IDLE,
      error: 'That could not be rendered. Try a different photograph or shorter text.',
    };
  }

  // A data URL rather than a stored file: most renders are throwaway
  // iterations, and writing every keystroke's worth of experiment into the
  // library would bury the real photographs.
  const preview = `data:image/png;base64,${png.toString('base64')}`;

  if (!input.save) {
    return { ...CREATIVE_IDLE, preview, message: 'Rendered. Download it, or save it to the shoot.' };
  }

  // Saved into the same shoot as the source photograph, so it stays with the
  // work it came from and is selectable as ad creative.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sizeLabel =
    input.size === CUSTOM_SIZE
      ? `${input.customWidth ?? 1080}x${input.customHeight ?? 1080}`
      : input.size;
  const path = `${asset.shoot_id}/creative-${sizeLabel}-${stamp}.png`;

  const { error: uploadError } = await supabase.storage
    .from('photos')
    .upload(path, png, { contentType: 'image/png', upsert: false });

  if (uploadError) {
    return { ...CREATIVE_IDLE, preview, error: `Could not save: ${uploadError.message}` };
  }

  const { data: saved, error: insertError } = await supabase
    .from('assets')
    .insert({
      shoot_id: asset.shoot_id,
      storage_path: path,
      filename: `creative-${sizeLabel}.png`,
      mime_type: 'image/png',
      byte_size: png.byteLength,
      // Tagged so composites are filterable, and so nobody mistakes one for an
      // original frame when culling.
      tags: ['ad-creative'],
      alt_text: input.headline || null,
    })
    .select('id')
    .single();

  if (insertError || !saved) {
    // Roll the file back rather than leaving an orphan in the bucket that no
    // row points at and nothing will ever clean up.
    await supabase.storage.from('photos').remove([path]);
    return { ...CREATIVE_IDLE, preview, error: `Could not save: ${insertError?.message}` };
  }

  revalidatePath(`/library/${asset.shoot_id}`);

  return {
    error: null,
    message: 'Saved to the shoot. It can now be picked as ad creative.',
    preview,
    savedAssetId: saved.id,
  };
}
