'use server';

/**
 * Staff-side gallery management.
 *
 * Lives in its own module rather than the library's `actions.ts` because a
 * `'use server'` file exports an HTTP endpoint per function, and grouping the
 * ones that mint share links keeps that surface easy to review.
 *
 * The share token is returned to the caller exactly once, on creation. Only its
 * hash is stored, so nobody — including staff — can recover a link later. That
 * is a deliberate trade for the property that a database leak yields no working
 * gallery URLs; if a link is lost, you issue a new one.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { generateToken, hashPassword, hashToken } from '@/lib/galleries/tokens';
import { friendlyDbError } from '@/lib/schema-errors';
import type { GalleryAdminState } from './gallery-state';

const createSchema = z.object({
  shootId: z.string().uuid('Unknown shoot.'),
  title: z.string().trim().max(120).optional(),
  message: z.string().trim().max(1000).optional(),
  password: z.string().max(200).optional(),
  expiresInDays: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? Number(value) : undefined))
    .refine(
      (value) => value === undefined || (Number.isInteger(value) && value > 0 && value <= 3650),
      'Pick a number of days between 1 and 3650.',
    ),
  allowDownloads: z.string().optional(),
  watermark: z.string().optional(),
});

export async function createGallery(
  _previous: GalleryAdminState,
  formData: FormData,
): Promise<GalleryAdminState> {
  const { supabase, user } = await requireUser();

  const parsed = createSchema.safeParse({
    shootId: formData.get('shootId'),
    title: formData.get('title') ?? undefined,
    message: formData.get('message') ?? undefined,
    password: formData.get('password') ?? undefined,
    expiresInDays: formData.get('expiresInDays') ?? undefined,
    allowDownloads: formData.get('allowDownloads') ?? undefined,
    watermark: formData.get('watermark') ?? undefined,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Check those details.',
      message: null,
      shareUrl: null,
    };
  }

  const input = parsed.data;
  const token = generateToken();

  const password = input.password?.trim();
  const passwordHash = password ? await hashPassword(password) : null;

  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString()
    : null;

  const { error } = await supabase.from('galleries').insert({
    shoot_id: input.shootId,
    token_hash: hashToken(token),
    title: input.title ?? '',
    message: input.message || null,
    password_hash: passwordHash,
    expires_at: expiresAt,
    allow_downloads: input.allowDownloads === 'on',
    // Always 'full': downloads serve the original file. See the note in
    // gallery-panel.tsx — the column stays for when resizing is available.
    download_quality: 'full',
    watermark: input.watermark === 'on',
    created_by: user.id,
  });

  if (error) {
    return {
      error: friendlyDbError(error, 'The gallery could not be created.'),
      message: null,
      shareUrl: null,
    };
  }

  revalidatePath(`/library/${input.shootId}`);

  return {
    error: null,
    message: 'Gallery created. Copy the link now — it cannot be shown again.',
    shareUrl: `/g/${token}`,
  };
}

const galleryIdSchema = z.string().uuid('Unknown gallery.');

/**
 * Closes a gallery.
 *
 * Sets `revoked_at` rather than deleting, so the link stops working while the
 * favourites and approval it collected stay attached to the shoot. Deleting
 * would take the client's choices with it.
 */
export async function revokeGallery(
  _previous: GalleryAdminState,
  formData: FormData,
): Promise<GalleryAdminState> {
  const { supabase } = await requireUser();

  const parsed = galleryIdSchema.safeParse(formData.get('galleryId'));
  if (!parsed.success) {
    return { error: 'Unknown gallery.', message: null, shareUrl: null };
  }

  const { data: gallery, error } = await supabase
    .from('galleries')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', parsed.data)
    .select('shoot_id')
    .single();

  if (error || !gallery) {
    return {
      error: friendlyDbError(error, 'That gallery could not be closed.'),
      message: null,
      shareUrl: null,
    };
  }

  revalidatePath(`/library/${gallery.shoot_id}`);
  return { error: null, message: 'Gallery closed. The link no longer works.', shareUrl: null };
}

/**
 * Copies the client's favourites onto the studio's own selects.
 *
 * Deliberately a separate, explicit action rather than something the gallery
 * does automatically. `assets.is_select` is the photographer's editing
 * decision; the client's favourites are a different opinion about the same
 * photographs. Merging them on the client's click would silently overwrite
 * work, so it takes a human saying "yes, use theirs".
 */
export async function applyFavouritesAsSelects(
  _previous: GalleryAdminState,
  formData: FormData,
): Promise<GalleryAdminState> {
  const { supabase } = await requireUser();

  const parsed = galleryIdSchema.safeParse(formData.get('galleryId'));
  if (!parsed.success) {
    return { error: 'Unknown gallery.', message: null, shareUrl: null };
  }

  const { data: gallery } = await supabase
    .from('galleries')
    .select('id, shoot_id')
    .eq('id', parsed.data)
    .maybeSingle();

  if (!gallery) {
    return { error: 'That gallery no longer exists.', message: null, shareUrl: null };
  }

  const { data: favourites } = await supabase
    .from('gallery_favourites')
    .select('asset_id')
    .eq('gallery_id', gallery.id);

  const assetIds = (favourites ?? []).map((row) => row.asset_id);
  if (assetIds.length === 0) {
    return {
      error: 'This client has not chosen any photographs yet.',
      message: null,
      shareUrl: null,
    };
  }

  // Additive: existing selects are left alone rather than being replaced by
  // the client's set, so a photographer who already culled does not lose it.
  const { error } = await supabase
    .from('assets')
    .update({ is_select: true })
    .in('id', assetIds);

  if (error) {
    return {
      error: friendlyDbError(error, 'Those picks could not be applied.'),
      message: null,
      shareUrl: null,
    };
  }

  revalidatePath(`/library/${gallery.shoot_id}`);
  return {
    error: null,
    message: `Marked ${assetIds.length} of the client's picks as selects.`,
    shareUrl: null,
  };
}
