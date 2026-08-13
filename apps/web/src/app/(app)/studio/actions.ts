'use server';

/**
 * All mutations for the studio module.
 *
 * Three rules hold everywhere in this file:
 *
 * 1. `requireUser()` first, always. These functions are reachable by direct
 *    POST — a button that only renders for staff proves nothing about the
 *    caller.
 * 2. The typed brief is untrusted input that reaches a model and a database.
 *    It is never interpolated into a query string; every read it drives goes
 *    through parameterised Supabase calls (`.in()`, `.overlaps()`, `.eq()`) or
 *    the character-restricted `.or()` builder in `lib/studio/queries.ts`.
 * 3. Nothing lands in `assets` or goes live in a campaign implicitly. A
 *    shortlist photo and a generated image both start at `decision: 'pending'`
 *    and only move on an explicit action taken here.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import sharp from 'sharp';
import { CAMPAIGN_OBJECTIVES, type CampaignObjective } from '@lensello/core';
import { getIntegrations, IntegrationError } from '@lensello/core/integrations';
import { requireUser } from '@/lib/auth';
import type { Database, TablesInsert } from '@/lib/db.types';
import {
  AD_SIZE_KEYS,
  CUSTOM_SIZE,
  MAX_DIMENSION,
  MIN_DIMENSION,
  dimensionsFor,
  type CreativeInput,
} from '@/lib/creative/spec';
import { renderCreative } from '@/lib/creative/render';
import { getCampaign } from '@/lib/campaigns/queries';
import { MAX_ASSETS_PER_POST, platformSchema, sanitizeCaption } from '@/lib/campaigns/validation';
import { CAPTION_BATCH_SIZE, GENERATED_TAG, isUuid } from '@/lib/studio/constants';
import { getCaptionProgress, runCaptioningBatch } from '@/lib/studio/caption';
import { interpretBrief } from '@/lib/studio/interpret';
import { findCandidateAssets, listKnownShootTypes, PHOTOS_BUCKET } from '@/lib/studio/queries';
import { rankCandidates } from '@/lib/studio/search';
import { failed, ok, type ActionState } from './action-state';

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

/** `generated/<request or "adhoc">/<uuid>.png` — never under a shoot's own prefix. */
function generatedPath(requestId: string | null): string {
  const scope = requestId ?? 'adhoc';
  return `generated/${scope}/${crypto.randomUUID()}.png`;
}

/**
 * Normalises whatever `imageGen`/the compositor produced into a real PNG.
 *
 * The `photos` bucket's `allowed_mime_types` does not include `image/svg+xml`
 * — the mock adapter's placeholder output — and a live provider is not
 * guaranteed to hand back PNG bytes either. Rasterising once here means every
 * row in `generated_images` points at the same, bucket-legal format.
 */
async function toPng(bytes: Uint8Array): Promise<Buffer> {
  return sharp(Buffer.from(bytes)).png().toBuffer();
}

// --- the brief box -----------------------------------------------------

const submitBriefSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(3, 'Describe what you want in a few more words.')
    .max(2000, 'Keep the brief under 2000 characters.'),
  shootId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && isUuid(value) ? value : null)),
});

/**
 * Turns a plain-English brief into a stored request, an interpretation, and a
 * ranked, rationale-carrying shortlist — then sends the photographer straight
 * to it.
 */
export async function submitBrief(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const parsed = submitBriefSchema.safeParse({
    prompt: text(formData, 'prompt'),
    shootId: text(formData, 'shootId'),
  });
  if (!parsed.success) return failed(parsed.error.issues[0]?.message ?? 'Check the brief.');

  const { prompt, shootId } = parsed.data;

  // The prompt is stored exactly as typed, before any interpretation touches
  // it — a disappointing shortlist must be traceable to the real words used.
  const { data: request, error: insertError } = await supabase
    .from('studio_requests')
    .insert({ prompt, shoot_id: shootId, status: 'searching', created_by: user.id })
    .select('id')
    .single();

  if (insertError || !request) {
    return failed('Could not save this brief. Please try again.');
  }

  const knownShootTypes = await listKnownShootTypes(supabase);
  const interpreted = await interpretBrief(prompt, { knownShootTypes });

  const candidates = await findCandidateAssets(supabase, interpreted.labels, shootId);
  const ranked = rankCandidates(interpreted, candidates);

  const status = ranked.length > 0 ? 'ready' : 'failed';
  const failureReason =
    ranked.length > 0
      ? null
      : 'No photos in the library matched this brief yet. Caption more of the shoot, or try different words.';

  // `Json` (the jsonb column's type) is not exported by name from
  // `db.types.ts`; reaching it structurally through `Database` is the one
  // cast this needs, since `InterpretedBrief` is already JSON-shaped.
  type InterpretedColumn = Database['public']['Tables']['studio_requests']['Update']['interpreted'];

  await supabase
    .from('studio_requests')
    .update({
      interpreted: interpreted as unknown as InterpretedColumn,
      status,
      failure_reason: failureReason,
    })
    .eq('id', request.id);

  if (ranked.length > 0) {
    const rows: TablesInsert<'studio_shortlist'>[] = ranked.map((entry, index) => ({
      request_id: request.id,
      asset_id: entry.assetId,
      rank: index,
      rationale: entry.rationale,
      score: entry.score,
    }));

    const { error: shortlistError } = await supabase.from('studio_shortlist').insert(rows);
    if (shortlistError) {
      await supabase
        .from('studio_requests')
        .update({ status: 'failed', failure_reason: 'The shortlist could not be saved.' })
        .eq('id', request.id);
    }
  }

  revalidatePath('/studio');
  redirect(`/studio/${request.id}`);
}

// --- shortlist decisions -------------------------------------------------

const decisionSchema = z.enum(['approved', 'rejected']);

/**
 * Approve or reject one shortlisted photo.
 *
 * Called directly from a client component rather than through a `<form>` —
 * same pattern as `setPostAssets` in the campaigns module — because each row
 * in a shortlist of dozens needs its own independent, immediate decision.
 */
export async function decideShortlistItem(
  itemId: string,
  decision: 'approved' | 'rejected',
): Promise<ActionState> {
  const { supabase } = await requireUser();

  if (!isUuid(itemId)) return failed('That photo could not be identified.');
  const parsedDecision = decisionSchema.safeParse(decision);
  if (!parsedDecision.success) return failed('That is not a valid decision.');

  const { data: row } = await supabase
    .from('studio_shortlist')
    .select('id, request_id')
    .eq('id', itemId)
    .maybeSingle();
  if (!row) return failed('That shortlist entry no longer exists.');

  const { error } = await supabase
    .from('studio_shortlist')
    .update({ decision: parsedDecision.data, decided_at: new Date().toISOString() })
    .eq('id', itemId);

  if (error) return failed('Could not save that decision. Please try again.');

  revalidatePath(`/studio/${row.request_id}`);
  return ok(parsedDecision.data === 'approved' ? 'Approved.' : 'Rejected.');
}

// --- push to a campaign --------------------------------------------------

const pushToCampaignSchema = z.object({
  requestId: z.string().refine(isUuid, 'That brief could not be identified.'),
  campaignId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && isUuid(value) ? value : null)),
  newCampaignName: z.string().trim().max(120).optional().default(''),
  objective: z.enum(CAMPAIGN_OBJECTIVES).optional().default('showcase_portfolio'),
  platform: platformSchema,
  caption: z.string().max(2200).optional().default(''),
});

/**
 * Takes every approved photo from a brief's shortlist and files it as a
 * draft post — never published, never even 'approved' at the post level,
 * just moved from "the studio picked these" to "these are attached to a
 * post a human can now write copy for and push through the normal campaign
 * workflow."
 */
export async function pushApprovedToCampaign(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = pushToCampaignSchema.safeParse({
    requestId: text(formData, 'requestId'),
    campaignId: text(formData, 'campaignId'),
    newCampaignName: text(formData, 'newCampaignName'),
    objective: text(formData, 'objective') || undefined,
    platform: text(formData, 'platform'),
    caption: text(formData, 'caption'),
  });
  if (!parsed.success) return failed(parsed.error.issues[0]?.message ?? 'Check the form.');

  const input = parsed.data;

  const { data: approved, error: shortlistError } = await supabase
    .from('studio_shortlist')
    .select('asset_id')
    .eq('request_id', input.requestId)
    .eq('decision', 'approved')
    .order('rank', { ascending: true });

  if (shortlistError) return failed('Could not load the approved photos.');
  if (!approved || approved.length === 0) {
    return failed('Approve at least one photo before pushing it to a campaign.');
  }

  const assetIds = approved.slice(0, MAX_ASSETS_PER_POST).map((row) => row.asset_id);

  let campaignId = input.campaignId;

  if (campaignId) {
    const campaign = await getCampaign(supabase, campaignId);
    if (!campaign) return failed('That campaign no longer exists.');
  } else {
    const insert: TablesInsert<'campaigns'> = {
      name: input.newCampaignName || 'From the studio',
      objective: input.objective as CampaignObjective,
      status: 'draft',
      platforms: [input.platform],
    };
    const { data: created, error: campaignError } = await supabase
      .from('campaigns')
      .insert(insert)
      .select('id')
      .single();
    if (campaignError || !created) return failed('Could not create the campaign.');
    campaignId = created.id;
  }

  const postInsert: TablesInsert<'campaign_posts'> = {
    campaign_id: campaignId,
    platform: input.platform,
    caption: sanitizeCaption(input.caption),
    asset_ids: assetIds,
    status: 'draft',
  };

  const { error: postError } = await supabase.from('campaign_posts').insert(postInsert);
  if (postError) return failed('The photos were approved, but the post could not be created.');

  await supabase
    .from('studio_requests')
    .update({ campaign_id: campaignId, status: 'approved' })
    .eq('id', input.requestId);

  revalidatePath(`/studio/${input.requestId}`);
  revalidatePath('/campaigns');
  redirect(`/campaigns/${campaignId}`);
}

// --- captioning pass -------------------------------------------------------

const captionShootSchema = z.object({
  shootId: z.string().refine(isUuid, 'Pick a shoot to caption.'),
});

/**
 * Processes one batch of un-captioned photos in a shoot.
 *
 * Click it again to keep going — see `runCaptioningBatch` for why that is
 * safe to do any number of times, including after an interruption.
 */
export async function runCaptioning(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = captionShootSchema.safeParse({ shootId: text(formData, 'shootId') });
  if (!parsed.success) return failed(parsed.error.issues[0]?.message ?? 'Pick a shoot.');

  const result = await runCaptioningBatch(supabase, parsed.data.shootId, CAPTION_BATCH_SIZE);

  revalidatePath('/studio');

  if (result.processed === 0) {
    return ok('Every photo in this shoot already has a caption.');
  }

  const preserved =
    result.labelsPreserved > 0
      ? ` (${result.labelsPreserved} manual label${result.labelsPreserved === 1 ? '' : 's'} left untouched)`
      : '';

  return ok(
    `Captioned ${result.processed} photo${result.processed === 1 ? '' : 's'}, wrote ${result.labelsWritten} label${result.labelsWritten === 1 ? '' : 's'}${preserved}. ${result.remaining} left in this shoot.`,
  );
}

/** Read behind `'use server'`, for the shoot picker's progress display. */
export async function fetchCaptionProgress(
  shootId: string,
): Promise<{ total: number; captioned: number } | null> {
  const { supabase } = await requireUser();
  if (!isUuid(shootId)) return null;
  return getCaptionProgress(supabase, shootId);
}

// --- generated artwork: imageGen ------------------------------------------

const generateArtworkSchema = z.object({
  requestId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && isUuid(value) ? value : null)),
  prompt: z.string().trim().min(3, 'Describe the graphic you want.').max(500),
  aspectRatio: z.enum(['1:1', '4:5', '16:9', '9:16']).catch('1:1'),
  count: z.coerce.number().int().min(1).max(4).catch(1),
});

/**
 * Calls the `imageGen` adapter for campaign artwork.
 *
 * Every image lands in `generated_images` at `decision: 'pending'` — never in
 * `assets`. Reaching a model is entirely through `getIntegrations().imageGen`;
 * nothing here calls a provider directly.
 */
export async function generateArtwork(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const parsed = generateArtworkSchema.safeParse({
    requestId: text(formData, 'requestId'),
    prompt: text(formData, 'prompt'),
    aspectRatio: text(formData, 'aspectRatio'),
    count: text(formData, 'count') || '1',
  });
  if (!parsed.success) return failed(parsed.error.issues[0]?.message ?? 'Check the form.');

  const input = parsed.data;
  const imageGen = getIntegrations().imageGen;

  let images;
  try {
    images = await imageGen.generate({
      prompt: input.prompt,
      aspectRatio: input.aspectRatio,
      count: input.count,
    });
  } catch (cause) {
    return failed(
      cause instanceof IntegrationError
        ? `${imageGen.provider} could not generate that: ${cause.message}`
        : 'Image generation failed. Please try again.',
    );
  }

  let saved = 0;
  for (const image of images) {
    let png: Buffer;
    try {
      png = await toPng(image.data);
    } catch {
      continue;
    }

    const path = generatedPath(input.requestId);
    const { error: uploadError } = await supabase.storage
      .from(PHOTOS_BUCKET)
      .upload(path, png, { contentType: 'image/png', upsert: false });
    if (uploadError) continue;

    const insert: TablesInsert<'generated_images'> = {
      request_id: input.requestId,
      storage_path: path,
      prompt: input.prompt,
      provider: imageGen.provider,
      model: image.model,
      width: image.width,
      height: image.height,
      created_by: user.id,
    };
    const { error: rowError } = await supabase.from('generated_images').insert(insert);
    if (rowError) {
      await supabase.storage.from(PHOTOS_BUCKET).remove([path]);
      continue;
    }
    saved += 1;
  }

  if (input.requestId) revalidatePath(`/studio/${input.requestId}`);

  if (saved === 0) return failed('Nothing could be saved from that generation. Please try again.');
  return ok(
    `Generated ${saved} image${saved === 1 ? '' : 's'}, pending review — nothing here is used until you approve it.`,
  );
}

// --- generated artwork: the compositor, on a shortlisted photo ------------

const overlaySchema = z.object({
  requestId: z.string().refine(isUuid, 'That brief could not be identified.'),
  assetId: z.string().refine(isUuid, 'Pick a photograph.'),
  size: z.enum([CUSTOM_SIZE, ...AD_SIZE_KEYS] as [string, ...string[]]),
  customWidth: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? Number(value) : undefined))
    .refine(
      (value) =>
        value === undefined || (Number.isFinite(value) && value >= MIN_DIMENSION && value <= MAX_DIMENSION),
      `Width must be between ${MIN_DIMENSION} and ${MAX_DIMENSION} pixels.`,
    ),
  customHeight: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? Number(value) : undefined))
    .refine(
      (value) =>
        value === undefined || (Number.isFinite(value) && value >= MIN_DIMENSION && value <= MAX_DIMENSION),
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
});

/**
 * Runs the ad-creative compositor (`lib/creative`) against a photo the
 * studio's own search already shortlisted, and files the result as a
 * `generated_images` row rather than saving it into `assets` the way the ads
 * module's own "save to the shoot" does. This overlay is a marketing graphic
 * derived from a real photograph, not the photograph itself — it still needs
 * a human decision before it exists anywhere but here.
 */
export async function renderShortlistOverlay(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const parsed = overlaySchema.safeParse({
    requestId: text(formData, 'requestId'),
    assetId: text(formData, 'assetId'),
    size: text(formData, 'size') || 'instagram_square',
    customWidth: text(formData, 'customWidth') || undefined,
    customHeight: text(formData, 'customHeight') || undefined,
    headline: text(formData, 'headline'),
    subline: text(formData, 'subline'),
    callToAction: text(formData, 'callToAction'),
    studioName: text(formData, 'studioName'),
    position: text(formData, 'position') || 'bottom',
    scrim: text(formData, 'scrim') || '0.55',
  });
  if (!parsed.success) return failed(parsed.error.issues[0]?.message ?? 'Check the form.');

  const input = parsed.data;

  // Scoped to this brief's own shortlist, not any asset in the library — the
  // form only ever offers photos the studio already surfaced for this brief.
  const { data: shortlistRow } = await supabase
    .from('studio_shortlist')
    .select('asset_id')
    .eq('request_id', input.requestId)
    .eq('asset_id', input.assetId)
    .maybeSingle();
  if (!shortlistRow) return failed('That photo is not part of this brief’s shortlist.');

  const { data: asset } = await supabase
    .from('assets')
    .select('storage_path')
    .eq('id', input.assetId)
    .maybeSingle();
  if (!asset) return failed('That photograph no longer exists.');

  const { data: file, error: downloadError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .download(asset.storage_path);
  if (downloadError || !file) return failed('That photograph could not be fetched.');

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

  const dimensions = dimensionsFor(spec);

  let png: Buffer;
  try {
    png = await renderCreative(Buffer.from(await file.arrayBuffer()), spec);
  } catch {
    return failed('That could not be rendered. Try a different photograph or shorter text.');
  }

  const path = generatedPath(input.requestId);
  const { error: uploadError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(path, png, { contentType: 'image/png', upsert: false });
  if (uploadError) return failed(`Could not save the render: ${uploadError.message}`);

  const insert: TablesInsert<'generated_images'> = {
    request_id: input.requestId,
    storage_path: path,
    prompt: `Text overlay on a shortlisted photo — headline: ${input.headline || '(none)'}`,
    provider: 'compositor',
    model: null,
    width: dimensions.width,
    height: dimensions.height,
    created_by: user.id,
  };
  const { error: rowError } = await supabase.from('generated_images').insert(insert);
  if (rowError) {
    await supabase.storage.from(PHOTOS_BUCKET).remove([path]);
    return failed('Rendered, but could not be saved. Please try again.');
  }

  revalidatePath(`/studio/${input.requestId}`);
  return ok('Rendered, pending review — nothing here is used until you approve it.');
}

// --- generated image decisions -------------------------------------------

/** Approve or reject one generated image. Direct-callable, same pattern as `decideShortlistItem`. */
export async function decideGeneratedImage(
  imageId: string,
  decision: 'approved' | 'rejected',
): Promise<ActionState> {
  const { supabase } = await requireUser();

  if (!isUuid(imageId)) return failed('That image could not be identified.');
  const parsedDecision = decisionSchema.safeParse(decision);
  if (!parsedDecision.success) return failed('That is not a valid decision.');

  const { data: row } = await supabase
    .from('generated_images')
    .select('id, request_id')
    .eq('id', imageId)
    .maybeSingle();
  if (!row) return failed('That image no longer exists.');

  const { error } = await supabase
    .from('generated_images')
    .update({ decision: parsedDecision.data, decided_at: new Date().toISOString() })
    .eq('id', imageId);

  if (error) return failed('Could not save that decision. Please try again.');

  if (row.request_id) revalidatePath(`/studio/${row.request_id}`);
  return ok(parsedDecision.data === 'approved' ? 'Approved.' : 'Rejected.');
}

// --- the one deliberate promotion path ------------------------------------

const promoteSchema = z.object({
  imageId: z.string().refine(isUuid, 'That image could not be identified.'),
  shootId: z.string().refine(isUuid, 'Pick a shoot to file this under.'),
});

/**
 * Files an approved generated image into `assets` — the one path by which a
 * synthetic image can ever appear there, and it only runs on an explicit
 * click against a row that is already `decision: 'approved'`.
 *
 * The new asset is tagged `ai-generated` and its alt text says so up front,
 * so it reads as generated everywhere `assets` is shown — the grid, the tag
 * filter, a gallery pick — not just here.
 */
export async function promoteGeneratedImage(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = promoteSchema.safeParse({
    imageId: text(formData, 'imageId'),
    shootId: text(formData, 'shootId'),
  });
  if (!parsed.success) return failed(parsed.error.issues[0]?.message ?? 'Check the form.');

  const { data: image } = await supabase
    .from('generated_images')
    .select('*')
    .eq('id', parsed.data.imageId)
    .maybeSingle();
  if (!image) return failed('That image no longer exists.');

  if (image.decision !== 'approved') {
    return failed('Approve this image before adding it to the library.');
  }
  if (image.asset_id) {
    return failed('This image is already in the library.');
  }

  const { data: shoot } = await supabase
    .from('shoots')
    .select('id')
    .eq('id', parsed.data.shootId)
    .maybeSingle();
  if (!shoot) return failed('That shoot no longer exists.');

  const { data: file } = await supabase.storage.from(PHOTOS_BUCKET).download(image.storage_path);
  const byteSize = file ? (await file.arrayBuffer()).byteLength : 0;

  const insert: TablesInsert<'assets'> = {
    shoot_id: shoot.id,
    storage_path: image.storage_path,
    filename: image.storage_path.split('/').pop() ?? 'generated.png',
    mime_type: 'image/png',
    byte_size: byteSize,
    width: image.width,
    height: image.height,
    tags: [GENERATED_TAG],
    alt_text: `AI-generated image — not a photograph. Prompt: ${image.prompt.slice(0, 160)}`,
  };

  const { data: asset, error: assetError } = await supabase
    .from('assets')
    .insert(insert)
    .select('id')
    .single();
  if (assetError || !asset) return failed('Could not add this to the library. Please try again.');

  await supabase.from('generated_images').update({ asset_id: asset.id }).eq('id', image.id);

  if (image.request_id) revalidatePath(`/studio/${image.request_id}`);
  return ok('Added to the library, labelled as generated.');
}
