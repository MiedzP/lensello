/**
 * The portal dashboard: every gallery a client is entitled to, as cards.
 *
 * Runs with the service role for the same reason the gallery routes do — a
 * portal session is not a Supabase session, so there is no RLS context to run
 * under. `listGalleriesForClient` already scopes the read to one `client_id`;
 * this module only adds the thumbnail and status a card needs to render.
 */

import type { createAdminClient } from '@/lib/supabase/admin';
import {
  GALLERY_URL_TTL_SECONDS,
  listGalleriesForClient,
  type DisplayStyle,
} from '@/lib/galleries/queries';
import { accessProblem } from '@/lib/galleries/tokens';
import { asGalleryLayout } from '@/lib/validators';

type Admin = ReturnType<typeof createAdminClient>;

/** The name to greet a signed-in client with. Falls back to their email if the client record has none. */
export async function getPortalClientName(
  admin: Admin,
  clientId: string,
  fallbackEmail: string,
): Promise<string> {
  const { data } = await admin.from('clients').select('name').eq('id', clientId).maybeSingle();
  return data?.name || fallbackEmail;
}

export interface PortalGalleryCard {
  id: string;
  title: string;
  shootTitle: string;
  shotAt: string | null;
  displayStyle: DisplayStyle;
  accentColor: string | null;
  coverUrl: string | null;
  isClosed: boolean;
  isApproved: boolean;
}

export async function listPortalGalleries(
  admin: Admin,
  clientId: string,
): Promise<PortalGalleryCard[]> {
  const entries = await listGalleriesForClient(admin, clientId);
  if (entries.length === 0) return [];

  const galleryIds = entries.map((entry) => entry.gallery.id);
  const shootIds = [...new Set(entries.map((entry) => entry.gallery.shoot_id))];
  const coverAssetIds = entries.flatMap((entry) =>
    entry.gallery.cover_asset_id ? [entry.gallery.cover_asset_id] : [],
  );

  const [{ data: coverAssets }, { data: firstAssets }, { data: approvals }] = await Promise.all([
    coverAssetIds.length
      ? admin.from('assets').select('id, storage_path').in('id', coverAssetIds)
      : Promise.resolve({ data: [] as Array<{ id: string; storage_path: string }> }),
    admin
      .from('assets')
      .select('id, shoot_id, storage_path')
      .in('shoot_id', shootIds)
      .order('captured_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true }),
    admin.from('gallery_approvals').select('gallery_id').in('gallery_id', galleryIds),
  ]);

  const coverPathById = new Map((coverAssets ?? []).map((asset) => [asset.id, asset.storage_path]));

  // The shoot's first photograph by capture order, for galleries with no
  // explicit cover — a card should never sit blank just because nobody picked one.
  const firstPathByShoot = new Map<string, string>();
  for (const asset of firstAssets ?? []) {
    if (!firstPathByShoot.has(asset.shoot_id)) firstPathByShoot.set(asset.shoot_id, asset.storage_path);
  }

  const approvedGalleryIds = new Set((approvals ?? []).map((row) => row.gallery_id));

  const pathByGalleryId = new Map<string, string>();
  for (const entry of entries) {
    const path =
      (entry.gallery.cover_asset_id && coverPathById.get(entry.gallery.cover_asset_id)) ||
      firstPathByShoot.get(entry.gallery.shoot_id);
    if (path) pathByGalleryId.set(entry.gallery.id, path);
  }

  const paths = [...new Set(pathByGalleryId.values())];
  const { data: signed } = paths.length
    ? await admin.storage.from('photos').createSignedUrls(paths, GALLERY_URL_TTL_SECONDS)
    : { data: [] as Array<{ path: string | null; signedUrl: string }> };

  const urlByPath = new Map(
    (signed ?? [])
      .filter((entry) => entry.signedUrl && entry.path)
      .map((entry) => [entry.path as string, entry.signedUrl]),
  );

  return entries.map(({ gallery, shoot }) => {
    const path = pathByGalleryId.get(gallery.id);
    return {
      id: gallery.id,
      title: gallery.title || shoot.title,
      shootTitle: shoot.title,
      shotAt: shoot.shot_at,
      displayStyle: asGalleryLayout(gallery.display_style) as DisplayStyle,
      accentColor: gallery.accent_color,
      coverUrl: path ? urlByPath.get(path) ?? null : null,
      isClosed: accessProblem(gallery) !== null,
      isApproved: approvedGalleryIds.has(gallery.id),
    };
  });
}
