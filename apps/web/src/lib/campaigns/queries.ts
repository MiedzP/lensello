/**
 * Read helpers for the campaigns module.
 *
 * Every function takes the caller's Supabase client so each query runs under
 * their RLS context — nothing here reaches for the service role.
 *
 * `db.types.ts` declares no PostgREST relationships, so these deliberately use
 * separate round trips instead of embedded selects: two small queries typecheck,
 * an untyped embed does not.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Asset,
  CampaignStatus,
  ShootType,
  SocialPlatform,
} from '@lensello/core';
import type { Database, Tables } from '@/lib/db.types';

export type Db = SupabaseClient<Database>;

export const PHOTOS_BUCKET = 'photos';

/**
 * Signed-URL lifetimes.
 *
 * Previews only have to outlive the page the user is looking at. Publishing is
 * different: the platform fetches the image itself, sometimes minutes after the
 * API call, so those URLs get a much longer window.
 */
export const PREVIEW_URL_TTL_SECONDS = 60 * 30;
export const PUBLISH_URL_TTL_SECONDS = 60 * 60 * 6;

export interface CampaignSummary {
  campaign: Tables<'campaigns'>;
  postCount: number;
  publishedCount: number;
}

export interface Photo {
  assetId: string;
  filename: string;
  altText: string | null;
  /** Null when the signed URL could not be minted (deleted object, etc.). */
  url: string | null;
}

export interface LibraryShoot {
  shootId: string;
  title: string;
  type: ShootType;
  shotAt: string | null;
  photos: Photo[];
}

// --- campaigns ----------------------------------------------------------

export async function listCampaignSummaries(
  db: Db,
  status?: CampaignStatus,
): Promise<CampaignSummary[]> {
  let query = db
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data: campaigns, error } = await query;
  if (error) throw new Error(error.message);
  if (!campaigns || campaigns.length === 0) return [];

  const { data: posts, error: postsError } = await db
    .from('campaign_posts')
    .select('id, campaign_id, status')
    .in(
      'campaign_id',
      campaigns.map((campaign) => campaign.id),
    );
  if (postsError) throw new Error(postsError.message);

  const totals = new Map<string, { total: number; published: number }>();
  for (const post of posts ?? []) {
    const entry = totals.get(post.campaign_id) ?? { total: 0, published: 0 };
    entry.total += 1;
    if (post.status === 'published') entry.published += 1;
    totals.set(post.campaign_id, entry);
  }

  return campaigns.map((campaign) => ({
    campaign,
    postCount: totals.get(campaign.id)?.total ?? 0,
    publishedCount: totals.get(campaign.id)?.published ?? 0,
  }));
}

/** Counts per status, so the filter bar can show them without a second render. */
export async function countCampaignsByStatus(
  db: Db,
): Promise<{ total: number; byStatus: Record<string, number> }> {
  const { data, error } = await db.from('campaigns').select('status');
  if (error) throw new Error(error.message);

  const byStatus: Record<string, number> = {};
  for (const row of data ?? []) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
  }
  return { total: data?.length ?? 0, byStatus };
}

export async function getCampaign(
  db: Db,
  campaignId: string,
): Promise<Tables<'campaigns'> | null> {
  const { data, error } = await db
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function listCampaignPosts(
  db: Db,
  campaignId: string,
): Promise<Tables<'campaign_posts'>[]> {
  const { data, error } = await db
    .from('campaign_posts')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getCampaignPost(
  db: Db,
  postId: string,
): Promise<Tables<'campaign_posts'> | null> {
  const { data, error } = await db
    .from('campaign_posts')
    .select('*')
    .eq('id', postId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Platforms stored on a campaign, filtered to the ones we understand. */
export function campaignPlatforms(
  campaign: Pick<Tables<'campaigns'>, 'platforms'>,
  known: readonly SocialPlatform[],
): SocialPlatform[] {
  const valid = new Set<string>(known);
  return campaign.platforms.filter((platform): platform is SocialPlatform =>
    valid.has(platform),
  );
}

// --- assets + storage ---------------------------------------------------

export async function getAssetsByIds(
  db: Db,
  assetIds: readonly string[],
): Promise<Tables<'assets'>[]> {
  if (assetIds.length === 0) return [];
  const { data, error } = await db
    .from('assets')
    .select('*')
    .in('id', [...new Set(assetIds)]);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Mints signed URLs for private-bucket objects in one round trip.
 *
 * `createSignedUrls` is the batch form of `createSignedUrl`; a campaign detail
 * page can reference dozens of photos and one request per photo would dominate
 * the page's latency.
 */
export async function signPhotoUrls(
  db: Db,
  paths: readonly string[],
  expiresIn: number,
): Promise<Map<string, string>> {
  const unique = [...new Set(paths)];
  const signed = new Map<string, string>();
  if (unique.length === 0) return signed;

  const { data, error } = await db.storage
    .from(PHOTOS_BUCKET)
    .createSignedUrls(unique, expiresIn);

  // A storage outage should not blank the whole page; callers render a
  // placeholder for any path that is missing from the map.
  if (error || !data) return signed;

  for (const entry of data) {
    if (entry.path && entry.signedUrl && !entry.error) {
      signed.set(entry.path, entry.signedUrl);
    }
  }
  return signed;
}

/**
 * Renderable photos for a set of asset ids, keyed by id.
 *
 * Built once per page rather than once per post: a campaign detail view holds
 * many posts drawing on overlapping assets, and this keeps it to two queries and
 * one signing request regardless of how many posts there are. Callers walk their
 * own `asset_ids` array to recover order — index 0 is the carousel cover, so
 * order is data, not presentation.
 */
export async function photoIndexFor(
  db: Db,
  assetIds: readonly string[],
  expiresIn = PREVIEW_URL_TTL_SECONDS,
): Promise<Map<string, Photo>> {
  const index = new Map<string, Photo>();
  if (assetIds.length === 0) return index;

  const assets = await getAssetsByIds(db, assetIds);
  const urls = await signPhotoUrls(
    db,
    assets.map((asset) => asset.storage_path),
    expiresIn,
  );

  for (const asset of assets) {
    index.set(asset.id, {
      assetId: asset.id,
      filename: asset.filename,
      altText: asset.alt_text,
      url: urls.get(asset.storage_path) ?? null,
    });
  }
  return index;
}

/** A post's photos in its own order, skipping ids that no longer resolve. */
export function orderedPhotos(
  assetIds: readonly string[],
  index: Map<string, Photo>,
): Photo[] {
  return assetIds.flatMap((assetId) => {
    const photo = index.get(assetId);
    return photo ? [photo] : [];
  });
}

/**
 * The photo picker's source: recent shoots with their strongest frames.
 *
 * Bounded on purpose — this is a chooser, not the library. The library module
 * owns browsing; here we surface selects and highly-rated frames first.
 */
export async function listLibraryPhotos(
  db: Db,
  { shootLimit = 8, perShoot = 12 } = {},
): Promise<LibraryShoot[]> {
  const { data: shoots, error: shootsError } = await db
    .from('shoots')
    .select('id, title, type, shot_at')
    .neq('status', 'archived')
    .order('shot_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(shootLimit);
  if (shootsError) throw new Error(shootsError.message);
  if (!shoots || shoots.length === 0) return [];

  const { data: assets, error: assetsError } = await db
    .from('assets')
    .select('id, shoot_id, storage_path, filename, alt_text')
    .in(
      'shoot_id',
      shoots.map((shoot) => shoot.id),
    )
    .order('is_select', { ascending: false })
    .order('rating', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(shootLimit * perShoot);
  if (assetsError) throw new Error(assetsError.message);

  const urls = await signPhotoUrls(
    db,
    (assets ?? []).map((asset) => asset.storage_path),
    PREVIEW_URL_TTL_SECONDS,
  );

  const grouped = new Map<string, Photo[]>();
  for (const asset of assets ?? []) {
    const photos = grouped.get(asset.shoot_id) ?? [];
    if (photos.length >= perShoot) continue;
    photos.push({
      assetId: asset.id,
      filename: asset.filename,
      altText: asset.alt_text,
      url: urls.get(asset.storage_path) ?? null,
    });
    grouped.set(asset.shoot_id, photos);
  }

  return shoots
    .map((shoot) => ({
      shootId: shoot.id,
      title: shoot.title,
      type: shoot.type as ShootType,
      shotAt: shoot.shot_at,
      photos: grouped.get(shoot.id) ?? [],
    }))
    .filter((shoot) => shoot.photos.length > 0);
}

/** Shoot types the studio actually has work in — grounding for the plan prompt. */
export async function listAvailableShootTypes(db: Db): Promise<ShootType[]> {
  const { data, error } = await db
    .from('shoots')
    .select('type')
    .neq('status', 'archived')
    .limit(500);
  if (error) return [];
  return [...new Set((data ?? []).map((row) => row.type as ShootType))];
}

/** Shoot type for the assets attached to a post, when they agree on one. */
export async function shootTypeForAssets(
  db: Db,
  assets: readonly Tables<'assets'>[],
): Promise<ShootType | null> {
  const shootIds = [...new Set(assets.map((asset) => asset.shoot_id))];
  if (shootIds.length === 0) return null;

  const { data, error } = await db
    .from('shoots')
    .select('type')
    .in('id', shootIds);
  if (error || !data || data.length === 0) return null;

  const types = [...new Set(data.map((row) => row.type as ShootType))];
  // Mixed shoot types would make the prompt claim something untrue.
  return types.length === 1 ? (types[0] ?? null) : null;
}

/** DB row -> the domain `Asset` the prompt builders in `@lensello/core` expect. */
export function toDomainAsset(row: Tables<'assets'>): Asset {
  return {
    id: row.id,
    shootId: row.shoot_id,
    storagePath: row.storage_path,
    filename: row.filename,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    width: row.width,
    height: row.height,
    rating: row.rating,
    isSelect: row.is_select,
    tags: row.tags,
    altText: row.alt_text,
    capturedAt: row.captured_at,
    createdAt: row.created_at,
  };
}
