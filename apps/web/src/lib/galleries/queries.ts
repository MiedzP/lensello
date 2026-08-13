/**
 * Reads for the client-facing gallery.
 *
 * These run with the **service role**, because a visitor holding a share token
 * has no session and must not be given one. Handing a wedding guest an
 * `authenticated` role to look at photographs would grant them every
 * staff-gated table in the database; the token buys access to one gallery and
 * nothing else, and that boundary is enforced here in code rather than by RLS.
 *
 * Everything in this module therefore takes a gallery id that was already
 * resolved from a token. No function here accepts a shoot id from the caller —
 * that would be the obvious way to turn one valid token into a key for every
 * gallery in the studio.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { createAdminClient } from '@/lib/supabase/admin';
import type { Database, Tables } from '@/lib/db.types';
import { accessProblem, hashToken, type GalleryAccessProblem } from './tokens';

type Admin = ReturnType<typeof createAdminClient>;
/** Either the admin client or a staff session's client — both typed the same. */
type Db = SupabaseClient<Database>;

export type GalleryRow = Tables<'galleries'>;
export const DISPLAY_STYLES = [
  'mosaic',
  'fine_art',
  'film_strip',
  'contact_sheet',
  'story',
] as const;
export type DisplayStyle = (typeof DISPLAY_STYLES)[number];

/** Copy for the staff style picker and the portal's own switcher — one source, so they can't drift apart. */
export const DISPLAY_STYLE_INFO: Record<DisplayStyle, { label: string; description: string }> = {
  mosaic: {
    label: 'Mosaic',
    description: 'Dense, justified rows. The whole shoot at a glance.',
  },
  fine_art: {
    label: 'Fine art',
    description: 'One photograph per screen, with room to breathe.',
  },
  film_strip: {
    label: 'Film strip',
    description: 'A large viewer with a scrubbable strip of frames below it.',
  },
  contact_sheet: {
    label: 'Contact sheet',
    description: 'A uniform proof sheet, numbered like a darkroom print.',
  },
  story: {
    label: 'Story',
    description: 'A single continuous scroll, told in chapters.',
  },
};

/** How long a gallery image URL stays valid. Long enough to browse and download. */
export const GALLERY_URL_TTL_SECONDS = 60 * 60 * 4;

export interface GalleryPhoto {
  id: string;
  url: string;
  filename: string;
  width: number | null;
  height: number | null;
  altText: string | null;
  isFavourite: boolean;
}

export interface ResolvedGallery {
  gallery: GalleryRow;
  shoot: Pick<Tables<'shoots'>, 'id' | 'title' | 'type' | 'shot_at'>;
  problem: GalleryAccessProblem | null;
  requiresPassword: boolean;
  approval: Tables<'gallery_approvals'> | null;
}

/**
 * Finds a gallery by its share token.
 *
 * Returns the access problem rather than throwing, so the page can tell a
 * client "this link has expired" instead of showing a 404 that reads as "your
 * photographer lost your photographs".
 */
export async function resolveGallery(
  admin: Admin,
  token: string,
): Promise<ResolvedGallery | null> {
  const { data: gallery } = await admin
    .from('galleries')
    .select('*')
    .eq('token_hash', hashToken(token))
    .maybeSingle();

  if (!gallery) return null;

  const [{ data: shoot }, { data: approval }] = await Promise.all([
    admin
      .from('shoots')
      .select('id, title, type, shot_at')
      .eq('id', gallery.shoot_id)
      .maybeSingle(),
    admin
      .from('gallery_approvals')
      .select('*')
      .eq('gallery_id', gallery.id)
      .maybeSingle(),
  ]);

  if (!shoot) return null;

  return {
    gallery,
    shoot,
    problem: accessProblem(gallery),
    requiresPassword: Boolean(gallery.password_hash),
    approval: approval ?? null,
  };
}

/**
 * Finds a gallery by id, but only if it belongs to the portal client asking
 * for it.
 *
 * The counterpart to `resolveGallery` for the portal: a portal session proves
 * who the client is, not which gallery they are allowed to open, so every
 * lookup here is scoped to `client_id` rather than trusting a bare id from the
 * URL. A signed-in client guessing another gallery's id gets exactly the same
 * "not found" a stranger guessing a token would.
 */
export async function resolveGalleryForClient(
  admin: Admin,
  galleryId: string,
  clientId: string,
): Promise<ResolvedGallery | null> {
  const { data: gallery } = await admin
    .from('galleries')
    .select('*')
    .eq('id', galleryId)
    .eq('client_id', clientId)
    .maybeSingle();

  if (!gallery) return null;

  const [{ data: shoot }, { data: approval }] = await Promise.all([
    admin
      .from('shoots')
      .select('id, title, type, shot_at')
      .eq('id', gallery.shoot_id)
      .maybeSingle(),
    admin
      .from('gallery_approvals')
      .select('*')
      .eq('gallery_id', gallery.id)
      .maybeSingle(),
  ]);

  if (!shoot) return null;

  return {
    gallery,
    shoot,
    problem: accessProblem(gallery),
    // The portal never asks for a password: signing in already proved who the
    // client is, and asking again would just be a second, redundant gate.
    requiresPassword: false,
    approval: approval ?? null,
  };
}

/**
 * Every gallery linked to one portal client, newest shoot first.
 *
 * Revoked and expired galleries are included rather than filtered out here —
 * the portal dashboard shows them as closed instead of making them vanish,
 * which reads as "the studio lost my photographs" rather than "this one closed".
 */
export async function listGalleriesForClient(
  admin: Admin,
  clientId: string,
): Promise<Array<{ gallery: GalleryRow; shoot: Pick<Tables<'shoots'>, 'id' | 'title' | 'type' | 'shot_at'> }>> {
  const { data: galleries } = await admin
    .from('galleries')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (!galleries?.length) return [];

  const shootIds = [...new Set(galleries.map((gallery) => gallery.shoot_id))];
  const { data: shoots } = await admin
    .from('shoots')
    .select('id, title, type, shot_at')
    .in('id', shootIds);

  const shootById = new Map((shoots ?? []).map((shoot) => [shoot.id, shoot]));

  return galleries.flatMap((gallery) => {
    const shoot = shootById.get(gallery.shoot_id);
    if (!shoot) return [];
    return [{ gallery, shoot }];
  });
}

/**
 * The photographs in a gallery, with signed URLs and the client's favourites
 * already marked.
 *
 * Signed rather than public: the bucket is private, so a leaked image URL
 * stops working on its own rather than exposing a couple's wedding
 * indefinitely.
 */
export async function listGalleryPhotos(
  admin: Admin,
  gallery: GalleryRow,
): Promise<GalleryPhoto[]> {
  const [{ data: assets }, { data: favourites }] = await Promise.all([
    admin
      .from('assets')
      .select('id, storage_path, filename, width, height, alt_text, captured_at, created_at')
      .eq('shoot_id', gallery.shoot_id)
      .order('captured_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true }),
    admin.from('gallery_favourites').select('asset_id').eq('gallery_id', gallery.id),
  ]);

  if (!assets?.length) return [];

  const favourited = new Set((favourites ?? []).map((row) => row.asset_id));

  const { data: signed } = await admin.storage
    .from('photos')
    .createSignedUrls(
      assets.map((asset) => asset.storage_path),
      GALLERY_URL_TTL_SECONDS,
    );

  const urlByPath = new Map(
    (signed ?? [])
      .filter((entry) => entry.signedUrl && entry.path)
      .map((entry) => [entry.path as string, entry.signedUrl]),
  );

  return assets.flatMap((asset) => {
    const url = urlByPath.get(asset.storage_path);
    // A photograph we cannot produce a URL for is omitted rather than rendered
    // as a broken image — a gap is confusing, a broken frame looks like a fault.
    if (!url) return [];

    return [
      {
        id: asset.id,
        url,
        filename: asset.filename,
        width: asset.width,
        height: asset.height,
        altText: asset.alt_text,
        isFavourite: favourited.has(asset.id),
      },
    ];
  });
}

/**
 * Whether the studio has anything for sale right now.
 *
 * Reads `print_products`, which belongs to the print-sales module, not this
 * one — but the gallery page is the one place that has to decide whether to
 * advertise "Order prints" at all. A gallery whose only products are all
 * turned off should not point to an empty shop.
 */
export async function hasActivePrintProducts(admin: Admin): Promise<boolean> {
  const { count } = await admin
    .from('print_products')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);
  return (count ?? 0) > 0;
}

/** Records that somebody opened the gallery. Best effort; never blocks a view. */
export async function recordView(
  admin: Admin,
  galleryId: string,
  ipHash: string | null,
  downloaded = false,
): Promise<void> {
  try {
    await admin
      .from('gallery_views')
      .insert({ gallery_id: galleryId, ip_hash: ipHash, downloaded });
  } catch (cause) {
    console.error('[gallery] could not record a view', cause);
  }
}

export interface GallerySummary {
  gallery: GalleryRow;
  favouriteCount: number;
  viewCount: number;
  lastViewedAt: string | null;
  approvedAt: string | null;
}

/** Staff-side summary for a shoot's galleries. Runs under the caller's session. */
export async function summarizeGalleries(
  supabase: Admin,
  shootId: string,
): Promise<GallerySummary[]> {
  const { data: galleries } = await supabase
    .from('galleries')
    .select('*')
    .eq('shoot_id', shootId)
    .order('created_at', { ascending: false });

  if (!galleries?.length) return [];

  const ids = galleries.map((gallery) => gallery.id);

  const [{ data: favourites }, { data: views }, { data: approvals }] =
    await Promise.all([
      supabase.from('gallery_favourites').select('gallery_id').in('gallery_id', ids),
      supabase
        .from('gallery_views')
        .select('gallery_id, created_at')
        .in('gallery_id', ids)
        .order('created_at', { ascending: false }),
      supabase.from('gallery_approvals').select('gallery_id, approved_at').in('gallery_id', ids),
    ]);

  const favouriteCounts = new Map<string, number>();
  for (const row of favourites ?? []) {
    favouriteCounts.set(row.gallery_id, (favouriteCounts.get(row.gallery_id) ?? 0) + 1);
  }

  const viewCounts = new Map<string, number>();
  const lastViewed = new Map<string, string>();
  for (const row of views ?? []) {
    viewCounts.set(row.gallery_id, (viewCounts.get(row.gallery_id) ?? 0) + 1);
    // Ordered newest first, so the first one seen per gallery is the latest.
    if (!lastViewed.has(row.gallery_id)) lastViewed.set(row.gallery_id, row.created_at);
  }

  const approvedAt = new Map(
    (approvals ?? []).map((row) => [row.gallery_id, row.approved_at]),
  );

  return galleries.map((gallery) => ({
    gallery,
    favouriteCount: favouriteCounts.get(gallery.id) ?? 0,
    viewCount: viewCounts.get(gallery.id) ?? 0,
    lastViewedAt: lastViewed.get(gallery.id) ?? null,
    approvedAt: approvedAt.get(gallery.id) ?? null,
  }));
}

// --- staff-side presentation management ----------------------------------
//
// Everything below runs under the caller's own Supabase client (RLS via
// `is_staff()`), for the `/galleries` area where the studio sets a gallery's
// display style, accent, cover image, sections and linked client. It is a
// deliberately separate surface from `/library`'s gallery panel, which only
// creates and revokes share links.

export interface StaffGalleryListItem {
  gallery: GalleryRow;
  shootTitle: string;
  clientName: string | null;
}

/** Every gallery in the studio, for the presentation-management list. */
export async function listGalleriesForStaff(db: Db): Promise<StaffGalleryListItem[]> {
  const { data: galleries } = await db
    .from('galleries')
    .select('*')
    .order('created_at', { ascending: false });

  if (!galleries?.length) return [];

  const shootIds = [...new Set(galleries.map((gallery) => gallery.shoot_id))];
  const clientIds = [
    ...new Set(galleries.flatMap((gallery) => (gallery.client_id ? [gallery.client_id] : []))),
  ];

  const [{ data: shoots }, { data: clients }] = await Promise.all([
    db.from('shoots').select('id, title').in('id', shootIds),
    clientIds.length
      ? db.from('clients').select('id, name').in('id', clientIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);

  const shootTitleById = new Map((shoots ?? []).map((shoot) => [shoot.id, shoot.title]));
  const clientNameById = new Map((clients ?? []).map((client) => [client.id, client.name]));

  return galleries.map((gallery) => ({
    gallery,
    shootTitle: shootTitleById.get(gallery.shoot_id) ?? 'Untitled shoot',
    clientName: gallery.client_id ? clientNameById.get(gallery.client_id) ?? null : null,
  }));
}

export interface StaffGalleryDetail {
  gallery: GalleryRow;
  shoot: Pick<Tables<'shoots'>, 'id' | 'title' | 'type'>;
  /** The shoot's assets, for the cover-image and section-assignment pickers. */
  assets: Pick<Tables<'assets'>, 'id' | 'filename' | 'storage_path'>[];
  client: Pick<Tables<'clients'>, 'id' | 'name' | 'email'> | null;
  portalAccount: Tables<'client_portal_accounts'> | null;
}

export async function getGalleryForStaff(
  db: Db,
  galleryId: string,
): Promise<StaffGalleryDetail | null> {
  const { data: gallery } = await db
    .from('galleries')
    .select('*')
    .eq('id', galleryId)
    .maybeSingle();

  if (!gallery) return null;

  const [{ data: shoot }, { data: assets }] = await Promise.all([
    db.from('shoots').select('id, title, type').eq('id', gallery.shoot_id).maybeSingle(),
    db
      .from('assets')
      .select('id, filename, storage_path')
      .eq('shoot_id', gallery.shoot_id)
      .order('captured_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
      .limit(1000),
  ]);

  if (!shoot) return null;

  let client: StaffGalleryDetail['client'] = null;
  let portalAccount: Tables<'client_portal_accounts'> | null = null;

  if (gallery.client_id) {
    const [{ data: clientRow }, { data: accountRow }] = await Promise.all([
      db.from('clients').select('id, name, email').eq('id', gallery.client_id).maybeSingle(),
      db
        .from('client_portal_accounts')
        .select('*')
        .eq('client_id', gallery.client_id)
        .maybeSingle(),
    ]);
    client = clientRow ?? null;
    portalAccount = accountRow ?? null;
  }

  return { gallery, shoot, assets: assets ?? [], client, portalAccount };
}

/** Long enough for one editing session; this is never handed to a visitor. */
const STAFF_THUMBNAIL_TTL_SECONDS = 60 * 60;

/**
 * Signed thumbnail URLs for the staff-side pickers — choosing a cover image,
 * assigning photographs to a section. Runs on the caller's own client, same
 * as the rest of this section: staff already have storage access under their
 * own session, so there is no reason to reach for the service role here.
 */
export async function signAssetThumbnails(
  db: Db,
  storagePaths: string[],
): Promise<Map<string, string>> {
  if (storagePaths.length === 0) return new Map();

  const { data: signed } = await db.storage
    .from('photos')
    .createSignedUrls([...new Set(storagePaths)], STAFF_THUMBNAIL_TTL_SECONDS);

  return new Map(
    (signed ?? [])
      .filter((entry) => entry.signedUrl && entry.path)
      .map((entry) => [entry.path as string, entry.signedUrl as string]),
  );
}
