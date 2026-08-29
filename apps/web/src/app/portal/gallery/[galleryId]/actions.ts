'use server';

/**
 * Interactions with a gallery from inside the portal: favouriting and
 * approving a selection.
 *
 * The portal counterpart to `/g/[token]/actions.ts`, authorized against the
 * session cookie and `galleries.client_id` instead of a bare share token — a
 * portal visitor never holds a token for the galleries listed on their
 * dashboard, only the session that says whose `client_id` they are.
 */

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyStudio } from '@/lib/notifications/notify';
import { resolveGalleryForClient, type ResolvedGallery } from '@/lib/galleries/queries';
import { PORTAL_COOKIE_NAME, readPortalSession } from '@/lib/portal/session';
import { PORTAL_GALLERY_IDLE, type PortalGalleryState } from './gallery-state';

type Admin = ReturnType<typeof createAdminClient>;

const galleryIdSchema = z.string().uuid();

type AuthResult =
  | { ok: false; error: string }
  | { ok: true; admin: Admin; resolved: ResolvedGallery };

async function authorize(rawGalleryId: FormDataEntryValue | null): Promise<AuthResult> {
  const parsed = galleryIdSchema.safeParse(rawGalleryId);
  if (!parsed.success) return { ok: false, error: 'That gallery could not be found.' };

  const admin = createAdminClient();
  const store = await cookies();
  const session = await readPortalSession(admin, store.get(PORTAL_COOKIE_NAME)?.value);

  if (!session) return { ok: false, error: 'Please sign in again.' };

  const resolved = await resolveGalleryForClient(admin, parsed.data, session.account.client_id);
  if (!resolved) return { ok: false, error: 'That gallery could not be found.' };

  if (resolved.problem === 'revoked') {
    return { ok: false, error: 'This gallery has been closed by the studio.' };
  }
  if (resolved.problem === 'expired') {
    return { ok: false, error: 'This gallery link has expired.' };
  }

  return { ok: true, admin, resolved };
}

export async function toggleFavouritePortal(
  _previous: PortalGalleryState,
  formData: FormData,
): Promise<PortalGalleryState> {
  const auth = await authorize(formData.get('galleryId'));
  if (auth.ok === false) return { error: auth.error, message: null };

  const { admin, resolved } = auth;

  // See the identical check in `/g/[token]/actions.ts`: an approved selection
  // is a commitment the album and the print order are built from.
  if (resolved.approval) {
    return {
      error:
        'Your selection has been approved, so it can no longer be changed. Contact the studio if you need to.',
      message: null,
    };
  }

  const assetId = formData.get('assetId');
  if (typeof assetId !== 'string' || !assetId) {
    return { error: 'That photograph could not be found.', message: null };
  }

  // Scoped to this gallery's shoot: without it, a signed-in client guessing an
  // asset id could favourite a photograph from a different shoot entirely.
  const { data: asset } = await admin
    .from('assets')
    .select('id')
    .eq('id', assetId)
    .eq('shoot_id', resolved.gallery.shoot_id)
    .maybeSingle();

  if (!asset) return { error: 'That photograph is not in this gallery.', message: null };

  const { data: existing } = await admin
    .from('gallery_favourites')
    .select('asset_id')
    .eq('gallery_id', resolved.gallery.id)
    .eq('asset_id', assetId)
    .maybeSingle();

  if (existing) {
    await admin
      .from('gallery_favourites')
      .delete()
      .eq('gallery_id', resolved.gallery.id)
      .eq('asset_id', assetId);
  } else {
    await admin.from('gallery_favourites').insert({ gallery_id: resolved.gallery.id, asset_id: assetId });
  }

  revalidatePath(`/portal/gallery/${resolved.gallery.id}`);
  return PORTAL_GALLERY_IDLE;
}

export async function approveSelectionPortal(
  _previous: PortalGalleryState,
  formData: FormData,
): Promise<PortalGalleryState> {
  const auth = await authorize(formData.get('galleryId'));
  if (auth.ok === false) return { error: auth.error, message: null };

  const { admin, resolved } = auth;

  if (resolved.approval) {
    return { error: null, message: 'This selection has already been approved.' };
  }

  const { count } = await admin
    .from('gallery_favourites')
    .select('asset_id', { count: 'exact', head: true })
    .eq('gallery_id', resolved.gallery.id);

  if ((count ?? 0) === 0) {
    return { error: 'Choose at least one photograph before approving.', message: null };
  }

  const name = formData.get('approvedName');
  const note = formData.get('note');

  const { error } = await admin.from('gallery_approvals').insert({
    gallery_id: resolved.gallery.id,
    approved_name: typeof name === 'string' ? name.trim().slice(0, 120) : '',
    note: typeof note === 'string' && note.trim() ? note.trim().slice(0, 1000) : null,
    favourite_count: count ?? 0,
  });

  if (error) {
    return { error: `That could not be saved: ${error.message}`, message: null };
  }

  await notifyStudio(
    `Gallery approved: ${resolved.gallery.title || resolved.shoot.title}`,
    [
      `${typeof name === 'string' && name.trim() ? name.trim() : 'The client'} has approved their selection.`,
      '',
      `Shoot: ${resolved.shoot.title}`,
      `Photographs chosen: ${count ?? 0}`,
      ...(typeof note === 'string' && note.trim() ? ['', `They added: ${note.trim()}`] : []),
    ].join('\n'),
  );

  revalidatePath(`/portal/gallery/${resolved.gallery.id}`);
  return { error: null, message: 'Thank you — your selection has been sent to the studio.' };
}
