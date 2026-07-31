'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import type { TablesInsert } from '@/lib/db.types';
import { libraryDb } from '@/lib/library/db';
import {
  MAX_UPLOAD_BYTES,
  PHOTOS_BUCKET,
  isAllowedMimeType,
  isShootStatus,
  isShootType,
  isStoragePathForShoot,
  isUuid,
} from '@/lib/library/constants';

/**
 * Every mutation in the library module.
 *
 * Each one opens with `requireUser()`: a Server Action is a public POST
 * endpoint, so the fact that the UI only renders a button for staff proves
 * nothing about who can invoke it. Every statement then runs through that
 * user's Supabase client, so RLS is the real boundary and the app layer is
 * defence in depth. The service-role key is never used here.
 *
 * Cache invalidation uses `revalidatePath`, not `updateTag`: `cacheTag` (and
 * therefore any tag `updateTag` could expire) requires the `cacheComponents`
 * flag in next.config.ts, which this module does not own and cannot set. Every
 * library read is cookie-bound and dynamic, so there is no tagged cache entry
 * to update — `revalidatePath` from a Server Action updates the UI immediately,
 * which is the read-your-own-writes behaviour we need.
 */

export interface ActionResult {
  ok: boolean;
  error: string | null;
}

const OK: ActionResult = { ok: true, error: null };

function fail(error: string): ActionResult {
  return { ok: false, error };
}

// --- input helpers -------------------------------------------------------

/**
 * Drops C0 controls and DEL.
 *
 * Written as a code-point filter rather than a regex so the source file stays
 * free of literal control bytes.
 */
function stripControlChars(value: string): string {
  return [...value]
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code >= 0x20 && code !== 0x7f;
    })
    .join('');
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function optionalText(formData: FormData, key: string, max = 2000): string | null {
  const value = text(formData, key).slice(0, max);
  return value.length > 0 ? value : null;
}

/**
 * `<input type="date">` gives `YYYY-MM-DD`; the column is `timestamptz`.
 *
 * Anchored at midday UTC rather than midnight so rendering the value back with
 * a local-timezone formatter cannot land on the previous day, which is the
 * classic off-by-one in date-only fields.
 */
function toTimestamp(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const parsed = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function cleanTag(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;

  // Collapse whitespace and drop control characters, so a tag is always one
  // readable token that round-trips through a text[] and a URL query.
  const tag = stripControlChars(raw)
    .replace(/\s+/g, ' ')
    .trim();

  if (tag.length === 0 || tag.length > 32) return null;
  return tag;
}

function assetIdList(ids: unknown): string[] | null {
  if (!Array.isArray(ids)) return null;

  const unique = [...new Set(ids.filter(isUuid))];
  if (unique.length === 0 || unique.length > 500) return null;

  return unique;
}

// --- shoots --------------------------------------------------------------

export async function createShoot(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const title = text(formData, 'title').slice(0, 200);
  const type = text(formData, 'type');
  const status = text(formData, 'status');
  const clientId = text(formData, 'client_id');

  if (title.length === 0) return fail('Give the shoot a title.');
  if (!isShootType(type)) return fail('Choose a shoot type.');
  if (!isShootStatus(status)) return fail('Choose a status.');
  if (clientId.length > 0 && !isUuid(clientId)) return fail('That client is not valid.');

  const { data, error } = await supabase
    .from('shoots')
    .insert({
      title,
      type,
      status,
      client_id: clientId.length > 0 ? clientId : null,
      shot_at: toTimestamp(text(formData, 'shot_at')),
      location: optionalText(formData, 'location', 200),
      notes: optionalText(formData, 'notes'),
    })
    .select('id')
    .single();

  if (error || !data) {
    return fail(error?.message ?? 'The shoot could not be created.');
  }

  revalidatePath('/library');
  // Outside the error handling above: redirect throws a control-flow exception.
  redirect(`/library/${data.id}`);
}

export async function updateShoot(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const shootId = text(formData, 'shoot_id');
  if (!isUuid(shootId)) return fail('That shoot is not valid.');

  const title = text(formData, 'title').slice(0, 200);
  const type = text(formData, 'type');
  const status = text(formData, 'status');
  const clientId = text(formData, 'client_id');

  if (title.length === 0) return fail('Give the shoot a title.');
  if (!isShootType(type)) return fail('Choose a shoot type.');
  if (!isShootStatus(status)) return fail('Choose a status.');
  if (clientId.length > 0 && !isUuid(clientId)) return fail('That client is not valid.');

  const { error } = await supabase
    .from('shoots')
    .update({
      title,
      type,
      status,
      client_id: clientId.length > 0 ? clientId : null,
      shot_at: toTimestamp(text(formData, 'shot_at')),
      location: optionalText(formData, 'location', 200),
      notes: optionalText(formData, 'notes'),
    })
    .eq('id', shootId);

  if (error) return fail(error.message);

  revalidatePath('/library');
  revalidatePath(`/library/${shootId}`);
  return OK;
}

export async function setShootCover(
  shootId: string,
  assetId: string,
): Promise<ActionResult> {
  const { supabase } = await requireUser();

  if (!isUuid(shootId) || !isUuid(assetId)) return fail('That photo is not valid.');

  // Confirm the asset belongs to this shoot before pointing the cover at it,
  // so a forged id cannot pull another shoot's photo onto this card.
  const { data: asset } = await supabase
    .from('assets')
    .select('id')
    .eq('id', assetId)
    .eq('shoot_id', shootId)
    .maybeSingle();

  if (!asset) return fail('That photo is not part of this shoot.');

  const { error } = await supabase
    .from('shoots')
    .update({ cover_asset_id: assetId })
    .eq('id', shootId);

  if (error) return fail(error.message);

  revalidatePath('/library');
  revalidatePath(`/library/${shootId}`);
  return OK;
}

// --- uploads -------------------------------------------------------------

export interface UploadedAsset {
  storagePath: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
}

function dimension(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value < 200_000
    ? value
    : null;
}

/**
 * Records rows for objects the browser has already put in Storage.
 *
 * The bytes go straight from the browser to Supabase Storage — streaming a
 * 100 MB photo through a Server Action would buffer it in the server process
 * for no benefit. This action only writes the metadata, and treats every field
 * as untrusted: the storage path in particular must sit directly under this
 * shoot's prefix, or a caller could register an object belonging to some other
 * shoot as one of ours.
 */
export async function recordUploadedAssets(
  shootId: string,
  uploads: UploadedAsset[],
): Promise<ActionResult & { created: number }> {
  const { supabase } = await requireUser();

  const failure = (message: string) => ({ ok: false, error: message, created: 0 });

  if (!isUuid(shootId)) return failure('That shoot is not valid.');
  if (!Array.isArray(uploads) || uploads.length === 0) return failure('Nothing to record.');
  if (uploads.length > 200) return failure('Too many files in one batch.');

  const { data: shoot } = await supabase
    .from('shoots')
    .select('id')
    .eq('id', shootId)
    .maybeSingle();

  if (!shoot) return failure('That shoot no longer exists.');

  const rows: TablesInsert<'assets'>[] = [];
  for (const upload of uploads) {
    if (!isStoragePathForShoot(upload?.storagePath, shootId)) {
      return failure('One of the uploads had an unexpected storage path.');
    }
    if (typeof upload.mimeType !== 'string' || !isAllowedMimeType(upload.mimeType)) {
      return failure('One of the uploads was not an accepted image type.');
    }
    if (
      typeof upload.byteSize !== 'number' ||
      !Number.isFinite(upload.byteSize) ||
      upload.byteSize < 0 ||
      upload.byteSize > MAX_UPLOAD_BYTES
    ) {
      return failure('One of the uploads was outside the 100 MB limit.');
    }

    const filename =
      typeof upload.filename === 'string'
        ? stripControlChars(upload.filename).slice(0, 255).trim()
        : '';

    rows.push({
      shoot_id: shootId,
      storage_path: upload.storagePath,
      filename: filename.length > 0 ? filename : 'photo',
      mime_type: upload.mimeType,
      byte_size: Math.round(upload.byteSize),
      width: dimension(upload.width),
      height: dimension(upload.height),
    });
  }

  const { data, error } = await supabase.from('assets').insert(rows).select('id');

  if (error) {
    // The objects are already in Storage. Leaving them there with no row would
    // be an invisible, permanent cost, so clean up before reporting — but only
    // the paths that genuinely have no row. `storage_path` is unique, so a
    // duplicate is one way this insert fails, and deleting the object out from
    // under the row that already owns it would turn one problem into two.
    const paths = rows.map((row) => row.storage_path);
    const { data: claimed } = await supabase
      .from('assets')
      .select('storage_path')
      .in('storage_path', paths);

    const owned = new Set((claimed ?? []).map((row) => row.storage_path));
    const orphans = paths.filter((path) => !owned.has(path));

    if (orphans.length > 0) {
      await supabase.storage.from(PHOTOS_BUCKET).remove(orphans);
    }

    return failure(`The photos were uploaded but could not be saved: ${error.message}`);
  }

  revalidatePath('/library');
  revalidatePath(`/library/${shootId}`);
  return { ok: true, error: null, created: data?.length ?? 0 };
}

// --- asset edits ---------------------------------------------------------

export async function setAssetsRating(
  shootId: string,
  assetIds: string[],
  rating: number,
): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const ids = assetIdList(assetIds);
  if (!isUuid(shootId) || !ids) return fail('Nothing to rate.');
  if (!Number.isInteger(rating) || rating < 0 || rating > 5) {
    return fail('A rating is 0 to 5 stars.');
  }

  const { error } = await supabase
    .from('assets')
    .update({ rating })
    .eq('shoot_id', shootId)
    .in('id', ids);

  if (error) return fail(error.message);

  revalidatePath(`/library/${shootId}`);
  return OK;
}

export async function setAssetsSelect(
  shootId: string,
  assetIds: string[],
  isSelect: boolean,
): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const ids = assetIdList(assetIds);
  if (!isUuid(shootId) || !ids) return fail('Nothing to update.');
  if (typeof isSelect !== 'boolean') return fail('Invalid select state.');

  const { error } = await supabase
    .from('assets')
    .update({ is_select: isSelect })
    .eq('shoot_id', shootId)
    .in('id', ids);

  if (error) return fail(error.message);

  revalidatePath('/library');
  revalidatePath(`/library/${shootId}`);
  return OK;
}

export async function addAssetsTag(
  shootId: string,
  assetIds: string[],
  rawTag: string,
): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const ids = assetIdList(assetIds);
  const tag = cleanTag(rawTag);
  if (!isUuid(shootId) || !ids) return fail('Nothing to tag.');
  if (!tag) return fail('A tag is 1 to 32 characters.');

  // One statement instead of a read-modify-write per row; see 20260731150100_library.sql.
  const { error } = await libraryDb(supabase).rpc('library_add_asset_tag', {
    p_shoot_id: shootId,
    p_asset_ids: ids,
    p_tag: tag,
  });

  if (error) return fail(error.message);

  revalidatePath(`/library/${shootId}`);
  return OK;
}

export async function removeAssetsTag(
  shootId: string,
  assetIds: string[],
  rawTag: string,
): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const ids = assetIdList(assetIds);
  const tag = cleanTag(rawTag);
  if (!isUuid(shootId) || !ids) return fail('Nothing to update.');
  if (!tag) return fail('That tag is not valid.');

  const { error } = await libraryDb(supabase).rpc('library_remove_asset_tag', {
    p_shoot_id: shootId,
    p_asset_ids: ids,
    p_tag: tag,
  });

  if (error) return fail(error.message);

  revalidatePath(`/library/${shootId}`);
  return OK;
}

/**
 * Alt text is edited by hand.
 *
 * There is no AI generation here on purpose: describing a photograph needs
 * vision input, and the shared `generateJson` in `@/lib/ai` only accepts text.
 */
export async function updateAssetAltText(
  shootId: string,
  assetId: string,
  altText: string,
): Promise<ActionResult> {
  const { supabase } = await requireUser();

  if (!isUuid(shootId) || !isUuid(assetId)) return fail('That photo is not valid.');
  if (typeof altText !== 'string') return fail('Alt text must be text.');

  const value = altText.trim().slice(0, 500);

  const { error } = await supabase
    .from('assets')
    .update({ alt_text: value.length > 0 ? value : null })
    .eq('shoot_id', shootId)
    .eq('id', assetId);

  if (error) return fail(error.message);

  revalidatePath(`/library/${shootId}`);
  return OK;
}

/**
 * Deletes a photo: the storage object and the row, never one without the other.
 *
 * Storage goes first. A leftover row with a missing object is visible in the
 * grid and the retry is harmless (Storage treats removing an absent object as
 * success), whereas an object with no row is invisible and bills forever.
 */
export async function deleteAsset(shootId: string, assetId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();

  if (!isUuid(shootId) || !isUuid(assetId)) return fail('That photo is not valid.');

  const { data: asset, error: readError } = await supabase
    .from('assets')
    .select('id, storage_path')
    .eq('id', assetId)
    .eq('shoot_id', shootId)
    .maybeSingle();

  if (readError) return fail(readError.message);
  if (!asset) return fail('That photo is not part of this shoot.');

  const { error: storageError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .remove([asset.storage_path]);

  if (storageError) {
    return fail(`The photo file could not be removed: ${storageError.message}`);
  }

  const { error: deleteError } = await supabase
    .from('assets')
    .delete()
    .eq('id', assetId)
    .eq('shoot_id', shootId);

  if (deleteError) {
    return fail(
      `The file was removed but its record could not be deleted: ${deleteError.message}`,
    );
  }

  // `shoots.cover_asset_id` is ON DELETE SET NULL, so the cover clears itself.
  revalidatePath('/library');
  revalidatePath(`/library/${shootId}`);
  return OK;
}
