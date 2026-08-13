/**
 * Downloading one photograph from inside the portal.
 *
 * The portal counterpart to `/g/[token]/download/[assetId]/route.ts` — same
 * reasoning throughout (serve the bytes from our own origin so the browser's
 * `download` attribute actually takes effect, enforce `allow_downloads` here
 * rather than only in the UI) — but authorized by the session cookie against
 * `galleries.client_id` instead of a token and its optional password.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveGalleryForClient } from '@/lib/galleries/queries';
import { PORTAL_COOKIE_NAME, readPortalSession } from '@/lib/portal/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(
  _request: Request,
  context: RouteContext<'/portal/gallery/[galleryId]/download/[assetId]'>,
) {
  const { galleryId, assetId } = await context.params;

  const admin = createAdminClient();
  const store = await cookies();
  const session = await readPortalSession(admin, store.get(PORTAL_COOKIE_NAME)?.value);

  if (!session) {
    return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  }

  const resolved = await resolveGalleryForClient(admin, galleryId, session.account.client_id);
  if (!resolved || resolved.problem) {
    return NextResponse.json({ error: 'Not available.' }, { status: 404 });
  }

  const { gallery } = resolved;

  if (!gallery.allow_downloads) {
    return NextResponse.json({ error: 'Downloads are turned off.' }, { status: 403 });
  }

  // Scoped to this gallery's shoot, or a signed-in client guessing an asset id
  // could download a photograph from a different shoot entirely.
  const { data: asset } = await admin
    .from('assets')
    .select('storage_path, filename, mime_type')
    .eq('id', assetId)
    .eq('shoot_id', gallery.shoot_id)
    .maybeSingle();

  if (!asset) {
    return NextResponse.json({ error: 'Not in this gallery.' }, { status: 404 });
  }

  const { data: file, error } = await admin.storage.from('photos').download(asset.storage_path);

  if (error || !file) {
    console.error('[portal] download failed', error);
    return NextResponse.json({ error: 'That photograph could not be fetched.' }, { status: 502 });
  }

  // Recorded so the studio can see this gallery was opened before chasing —
  // the portal's own view of the same signal `/g/[token]` records.
  try {
    await admin.from('gallery_views').insert({
      gallery_id: gallery.id,
      ip_hash: null,
      downloaded: true,
    });
  } catch (cause) {
    console.error('[portal] could not record a download', cause);
  }

  const safeName = asset.filename.replace(/["\\\r\n]/g, '_');

  return new NextResponse(file, {
    headers: {
      'Content-Type': asset.mime_type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
