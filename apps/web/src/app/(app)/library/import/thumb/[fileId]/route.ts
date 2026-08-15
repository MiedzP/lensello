/**
 * Proxies one Drive thumbnail to the browser.
 *
 * The browse grid cannot link to Drive directly: the service account's bearer
 * token is a secret and must never reach the client, so every request for a
 * preview image is re-authenticated here and the bytes are fetched
 * server-side through `getDriveSource()` — the one adapter allowed to talk to
 * Drive at all — then streamed back with our own headers. A missing or
 * unfetchable thumbnail is a 404, which the `<img onError>` in
 * `folder-gallery.tsx` turns into a placeholder icon rather than a broken
 * image.
 */

import { NextResponse } from 'next/server';
import { getDriveSource } from '@lensello/core/integrations';
import { requireUser } from '@/lib/auth';
import { isPlausibleDriveId } from '@/lib/drive/constants';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: RouteContext<'/library/import/thumb/[fileId]'>,
) {
  // Authenticates like any other staff-only read. This route serves no
  // client-facing token flow — see AGENTS.md's security section — it is
  // simply the one place an <img> tag can reach without exposing Drive
  // credentials to the browser.
  await requireUser();

  const { fileId } = await context.params;
  if (!isPlausibleDriveId(fileId)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  let thumbnail: { bytes: Uint8Array; mimeType: string } | null;
  try {
    thumbnail = await getDriveSource().fetchThumbnail(fileId);
  } catch (cause) {
    console.error('[drive-import] thumbnail fetch failed', cause);
    return NextResponse.json({ error: 'Could not reach Drive.' }, { status: 502 });
  }

  if (!thumbnail) {
    return NextResponse.json({ error: 'No thumbnail available.' }, { status: 404 });
  }

  return new NextResponse(Buffer.from(thumbnail.bytes), {
    headers: {
      'Content-Type': thumbnail.mimeType,
      // Short-lived and private: this is a preview of unpublished material,
      // not something to sit in a shared cache.
      'Cache-Control': 'private, max-age=300',
    },
  });
}
