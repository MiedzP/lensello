'use server';

/**
 * Gallery actions, called by people with a link and no account.
 *
 * Every one of these takes the **token**, never a gallery id, and re-resolves
 * it from scratch. A gallery id supplied by the caller would be the obvious way
 * to turn one valid link into a key for every gallery in the studio; the token
 * is the only thing the visitor is supposed to hold, so it is the only thing
 * trusted here.
 *
 * Access is re-checked on every call rather than once at page load. A link that
 * expires or is revoked while somebody has the tab open must stop working
 * immediately — not at their next refresh.
 */

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyStudio } from '@/lib/notifications/notify';
import { resolveGallery, type ResolvedGallery } from '@/lib/galleries/queries';
import type { createAdminClient as createAdmin } from '@/lib/supabase/admin';
import { verifyPassword } from '@/lib/galleries/tokens';
import {
  UNLOCK_TTL_SECONDS,
  signUnlock,
  unlockCookieName,
  verifyUnlock,
} from '@/lib/galleries/unlock';
import type { GalleryState } from './gallery-state';
import { GALLERY_IDLE } from './gallery-state';

type Admin = ReturnType<typeof createAdmin>;

const tokenSchema = z.string().trim().min(20).max(200);

/**
 * Resolves a token and confirms the caller may act on this gallery.
 *
 * Returns a string on refusal so callers surface the reason rather than a
 * generic failure — "this link has expired" is actionable, "something went
 * wrong" is not.
 */
type AuthResult =
  | { ok: false; error: string }
  | { ok: true; admin: Admin; resolved: ResolvedGallery };

function refuse(error: string): AuthResult {
  return { ok: false, error };
}

async function authorize(rawToken: FormDataEntryValue | null): Promise<AuthResult> {
  const parsed = tokenSchema.safeParse(rawToken);
  if (!parsed.success) return refuse('That link is not valid.');

  const admin = createAdminClient();
  const resolved = await resolveGallery(admin, parsed.data);

  if (!resolved) return refuse('That gallery could not be found.');

  if (resolved.problem === 'revoked') {
    return refuse('This gallery has been closed by the studio.');
  }
  if (resolved.problem === 'expired') {
    return refuse('This gallery link has expired.');
  }

  if (resolved.requiresPassword) {
    const store = await cookies();
    const cookie = store.get(unlockCookieName(resolved.gallery.id))?.value;
    if (!verifyUnlock(cookie, resolved.gallery.id, resolved.gallery.password_hash!)) {
      return refuse('Enter the gallery password first.');
    }
  }

  return { ok: true, admin, resolved };
}

export async function unlockGallery(
  _previous: GalleryState,
  formData: FormData,
): Promise<GalleryState> {
  const parsed = tokenSchema.safeParse(formData.get('token'));
  if (!parsed.success) return { error: 'That link is not valid.', message: null };

  const password = formData.get('password');
  if (typeof password !== 'string' || password.length === 0) {
    return { error: 'Enter the password.', message: null };
  }

  const admin = createAdminClient();
  const resolved = await resolveGallery(admin, parsed.data);

  if (!resolved || !resolved.gallery.password_hash) {
    return { error: 'That gallery could not be found.', message: null };
  }
  if (resolved.problem) {
    return {
      error:
        resolved.problem === 'expired'
          ? 'This gallery link has expired.'
          : 'This gallery has been closed by the studio.',
      message: null,
    };
  }

  const ok = await verifyPassword(password, resolved.gallery.password_hash);
  if (!ok) return { error: 'That password is not right.', message: null };

  const store = await cookies();
  store.set(
    unlockCookieName(resolved.gallery.id),
    signUnlock(resolved.gallery.id, resolved.gallery.password_hash),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: `/g/${parsed.data}`,
      maxAge: UNLOCK_TTL_SECONDS,
    },
  );

  revalidatePath(`/g/${parsed.data}`);
  return GALLERY_IDLE;
}

export async function toggleFavourite(
  _previous: GalleryState,
  formData: FormData,
): Promise<GalleryState> {
  const auth = await authorize(formData.get('token'));
  if (auth.ok === false) return { error: auth.error, message: null };

  const { admin, resolved } = auth;

  // An approved selection is a commitment the album and the print order are
  // built from. Letting it drift afterwards would mean the studio and the
  // client disagree about what was chosen, and only one of them would know.
  if (resolved.approval) {
    return {
      error: 'Your selection has been approved, so it can no longer be changed. Contact the studio if you need to.',
      message: null,
    };
  }

  const assetId = formData.get('assetId');
  if (typeof assetId !== 'string' || !assetId) {
    return { error: 'That photograph could not be found.', message: null };
  }

  // Scoped to this gallery's shoot: without it, a valid token plus a guessed
  // asset id would favourite a photograph from somebody else's wedding.
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
    await admin
      .from('gallery_favourites')
      .insert({ gallery_id: resolved.gallery.id, asset_id: assetId });
  }

  revalidatePath(`/g/${formData.get('token')}`);
  return GALLERY_IDLE;
}

export async function approveSelection(
  _previous: GalleryState,
  formData: FormData,
): Promise<GalleryState> {
  const auth = await authorize(formData.get('token'));
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
    // Captured at the moment of approval, so a later change is detectable
    // rather than quietly rewriting what was agreed.
    favourite_count: count ?? 0,
  });

  if (error) {
    return { error: `That could not be saved: ${error.message}`, message: null };
  }

  // The studio is told, or "sent to the studio" is a phrase with nothing
  // behind it — nobody would know a selection was ready.
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

  revalidatePath(`/g/${formData.get('token')}`);
  return { error: null, message: 'Thank you — your selection has been sent to the studio.' };
}
