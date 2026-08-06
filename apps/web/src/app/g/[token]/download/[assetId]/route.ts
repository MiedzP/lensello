/**
 * Downloading one photograph from a gallery.
 *
 * Exists because the obvious approach does not work: linking the signed
 * Supabase URL with a `download` attribute opens the image in a tab instead of
 * saving it, because browsers ignore that attribute cross-origin. Serving the
 * bytes from our own origin with `Content-Disposition: attachment` is what
 * actually produces a download.
 *
 * It also gives the studio's settings somewhere to be enforced. `allow_downloads`
 * is checked here rather than only hidden in the UI — a hidden link is not an
 * access control, and the URL is guessable once you have one.
 */

import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveGallery } from '@/lib/galleries/queries';
import { hashVisitor } from '@/lib/galleries/tokens';
import { unlockCookieName, verifyUnlock } from '@/lib/galleries/unlock';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(
  _request: Request,
  context: RouteContext<'/g/[token]/download/[assetId]'>,
) {
  const { token, assetId } = await context.params;

  const admin = createAdminClient();
  const resolved = await resolveGallery(admin, token);

  if (!resolved || resolved.problem) {
    return NextResponse.json({ error: 'Not available.' }, { status: 404 });
  }

  const { gallery } = resolved;

  if (!gallery.allow_downloads) {
    return NextResponse.json({ error: 'Downloads are turned off.' }, { status: 403 });
  }

  // The password gate applies here too. Otherwise a locked gallery leaks every
  // photograph to anyone who has the link and an asset id.
  if (gallery.password_hash) {
    const store = await cookies();
    const unlocked = verifyUnlock(
      store.get(unlockCookieName(gallery.id))?.value,
      gallery.id,
      gallery.password_hash,
    );
    if (!unlocked) {
      return NextResponse.json({ error: 'Locked.' }, { status: 403 });
    }
  }

  // Scoped to this gallery's shoot, or a valid token plus a guessed asset id
  // would download a photograph from somebody else's wedding.
  const { data: asset } = await admin
    .from('assets')
    .select('storage_path, filename, mime_type')
    .eq('id', assetId)
    .eq('shoot_id', gallery.shoot_id)
    .maybeSingle();

  if (!asset) {
    return NextResponse.json({ error: 'Not in this gallery.' }, { status: 404 });
  }

  const { data: file, error } = await admin.storage
    .from('photos')
    .download(asset.storage_path);

  if (error || !file) {
    console.error('[gallery] download failed', error);
    return NextResponse.json({ error: 'That photograph could not be fetched.' }, { status: 502 });
  }

  const headerList = await headers();
  const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim();

  // Recorded so "have they downloaded them yet" is answerable. Best effort.
  try {
    await admin.from('gallery_views').insert({
      gallery_id: gallery.id,
      ip_hash: ip ? hashVisitor(ip) : null,
      downloaded: true,
    });
  } catch (cause) {
    console.error('[gallery] could not record a download', cause);
  }

  // Quoted and stripped of anything that could break out of the header.
  const safeName = asset.filename.replace(/["\\\r\n]/g, '_');

  return new NextResponse(file, {
    headers: {
      'Content-Type': asset.mime_type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
