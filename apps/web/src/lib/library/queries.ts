import type { ShootStatus, ShootType } from '@lensello/core';
import type { Session } from '@/lib/auth';
import type { Tables } from '@/lib/db.types';
import { libraryDb } from './db';
import {
  ASSETS_PAGE_SIZE,
  DEFAULT_ASSET_SORT,
  DEFAULT_SHOOT_SORT,
  PHOTOS_BUCKET,
  SHOOTS_PAGE_SIZE,
  SIGNED_URL_TTL_SECONDS,
  isAssetSort,
  isShootSort,
  isShootStatus,
  isShootType,
  isUuid,
  type AssetSort,
  type ShootSort,
} from './constants';

/**
 * Read helpers for the library module.
 *
 * Server-only: every function takes the request-scoped Supabase client from
 * `requireUser()` / `requireUserOrRedirect()`, so all reads run under the
 * caller's RLS context. Nothing here uses the service-role key.
 *
 * The `photos` bucket is private. Images reach the browser as short-lived
 * signed URLs minted here, never as public object URLs.
 */

type Db = Session['supabase'];

// --- filters -------------------------------------------------------------

export interface ShootFilters {
  status: ShootStatus | null;
  type: ShootType | null;
  sort: ShootSort;
}

export interface AssetFilters {
  selectsOnly: boolean;
  tag: string | null;
  minRating: number;
  sort: AssetSort;
}

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Parses the shoots index query string. Unknown values fall back to defaults. */
export function parseShootFilters(searchParams: RawSearchParams): ShootFilters {
  const status = firstValue(searchParams.status);
  const type = firstValue(searchParams.type);
  const sort = firstValue(searchParams.sort);

  return {
    status: isShootStatus(status) ? status : null,
    type: isShootType(type) ? type : null,
    sort: isShootSort(sort) ? sort : DEFAULT_SHOOT_SORT,
  };
}

export function isShootFiltered(filters: ShootFilters): boolean {
  return filters.status !== null || filters.type !== null;
}

/** Parses the shoot detail query string. */
export function parseAssetFilters(searchParams: RawSearchParams): AssetFilters {
  const sort = firstValue(searchParams.sort);
  const tag = firstValue(searchParams.tag)?.trim();
  const rating = Number.parseInt(firstValue(searchParams.rating) ?? '', 10);

  return {
    selectsOnly: firstValue(searchParams.selects) === '1',
    tag: tag && tag.length > 0 ? tag : null,
    minRating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : 0,
    sort: isAssetSort(sort) ? sort : DEFAULT_ASSET_SORT,
  };
}

export function isAssetFiltered(filters: AssetFilters): boolean {
  return filters.selectsOnly || filters.tag !== null || filters.minRating > 0;
}

// --- view models ---------------------------------------------------------

/** Serialisable — these cross into Client Components. */
export interface ShootListItem {
  id: string;
  title: string;
  type: ShootType;
  status: ShootStatus;
  shotAt: string | null;
  location: string | null;
  clientName: string | null;
  assetCount: number;
  selectCount: number;
  /** Signed cover thumbnail, or null when the shoot has no photos yet. */
  coverUrl: string | null;
}

export interface AssetView {
  id: string;
  shootId: string;
  storagePath: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  rating: number;
  isSelect: boolean;
  tags: string[];
  altText: string | null;
  capturedAt: string | null;
  createdAt: string;
  /** Short-lived signed URL, or null when signing failed for this object. */
  url: string | null;
  isCover: boolean;
}

export interface ShootDetail {
  shoot: Tables<'shoots'>;
  clientName: string | null;
}

export interface ClientOption {
  id: string;
  name: string;
}

// --- storage -------------------------------------------------------------

/**
 * Mints signed URLs for a batch of storage paths.
 *
 * Resolves to a partial map rather than throwing: one unreadable object should
 * degrade a single tile, not blank the whole grid.
 */
async function signPaths(supabase: Db, paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((path) => path.length > 0))];
  const signed = new Map<string, string>();
  if (unique.length === 0) return signed;

  const { data, error } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);

  if (error || !data) return signed;

  for (const entry of data) {
    if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
  }

  return signed;
}

// --- reads ---------------------------------------------------------------

/** Clients available to link a shoot to. Small table; no pagination needed. */
export async function listClientOptions(supabase: Db): Promise<ClientOption[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name')
    .order('name', { ascending: true });

  if (error) throw new Error(`Could not load clients: ${error.message}`);

  return data ?? [];
}

export async function listShoots(
  supabase: Db,
  filters: ShootFilters,
): Promise<ShootListItem[]> {
  let query = supabase.from('shoots').select('*');

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.type) query = query.eq('type', filters.type);

  switch (filters.sort) {
    case 'date_asc':
      query = query.order('shot_at', { ascending: true, nullsFirst: false });
      break;
    case 'added_desc':
      query = query.order('created_at', { ascending: false });
      break;
    case 'title_asc':
      query = query.order('title', { ascending: true });
      break;
    default:
      query = query.order('shot_at', { ascending: false, nullsFirst: false });
  }

  const { data: shoots, error } = await query
    .order('created_at', { ascending: false })
    .limit(SHOOTS_PAGE_SIZE);

  if (error) throw new Error(`Could not load shoots: ${error.message}`);
  if (!shoots || shoots.length === 0) return [];

  const shootIds = shoots.map((shoot) => shoot.id);
  const clientIds = [
    ...new Set(shoots.map((shoot) => shoot.client_id).filter((id): id is string => !!id)),
  ];

  // Counts and cover paths come from `library_shoot_summaries()` (0002) so the
  // index does not have to ship one row per photo just to count them.
  const [summaries, clients] = await Promise.all([
    libraryDb(supabase).rpc('library_shoot_summaries').in('shoot_id', shootIds),
    clientIds.length > 0
      ? supabase.from('clients').select('id, name').in('id', clientIds)
      : Promise.resolve({ data: [] as ClientOption[], error: null }),
  ]);

  const summaryByShoot = new Map(
    (summaries.data ?? []).map((row) => [row.shoot_id, row] as const),
  );
  const clientNameById = new Map(
    (clients.data ?? []).map((client) => [client.id, client.name] as const),
  );

  const coverPaths = (summaries.data ?? [])
    .map((row) => row.cover_storage_path)
    .filter((path): path is string => !!path);
  const signed = await signPaths(supabase, coverPaths);

  return shoots.map((shoot) => {
    const summary = summaryByShoot.get(shoot.id);
    const coverPath = summary?.cover_storage_path ?? null;

    return {
      id: shoot.id,
      title: shoot.title,
      type: shoot.type,
      status: shoot.status,
      shotAt: shoot.shot_at,
      location: shoot.location,
      clientName: shoot.client_id ? (clientNameById.get(shoot.client_id) ?? null) : null,
      assetCount: Number(summary?.asset_count ?? 0),
      selectCount: Number(summary?.select_count ?? 0),
      coverUrl: coverPath ? (signed.get(coverPath) ?? null) : null,
    };
  });
}

/** One shoot plus its client's name. Returns null when it does not exist. */
export async function getShoot(supabase: Db, shootId: string): Promise<ShootDetail | null> {
  if (!isUuid(shootId)) return null;

  const { data: shoot, error } = await supabase
    .from('shoots')
    .select('*')
    .eq('id', shootId)
    .maybeSingle();

  if (error) throw new Error(`Could not load this shoot: ${error.message}`);
  if (!shoot) return null;

  let clientName: string | null = null;
  if (shoot.client_id) {
    const { data: client } = await supabase
      .from('clients')
      .select('name')
      .eq('id', shoot.client_id)
      .maybeSingle();
    clientName = client?.name ?? null;
  }

  return { shoot, clientName };
}

export async function listAssets(
  supabase: Db,
  shootId: string,
  filters: AssetFilters,
  coverAssetId: string | null,
): Promise<AssetView[]> {
  if (!isUuid(shootId)) return [];

  let query = supabase.from('assets').select('*').eq('shoot_id', shootId);

  // `assets_selects_idx` is a partial index on (shoot_id) where is_select, so
  // this is the read it was built for.
  if (filters.selectsOnly) query = query.eq('is_select', true);
  if (filters.minRating > 0) query = query.gte('rating', filters.minRating);
  if (filters.tag) query = query.contains('tags', [filters.tag]);

  switch (filters.sort) {
    case 'added_asc':
      query = query.order('created_at', { ascending: true });
      break;
    case 'rating_desc':
      query = query
        .order('rating', { ascending: false })
        .order('created_at', { ascending: false });
      break;
    default:
      query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query.limit(ASSETS_PAGE_SIZE);

  if (error) throw new Error(`Could not load photos: ${error.message}`);

  const assets = data ?? [];
  const signed = await signPaths(
    supabase,
    assets.map((asset) => asset.storage_path),
  );

  return assets.map((asset) => ({
    id: asset.id,
    shootId: asset.shoot_id,
    storagePath: asset.storage_path,
    filename: asset.filename,
    mimeType: asset.mime_type,
    byteSize: asset.byte_size,
    width: asset.width,
    height: asset.height,
    rating: asset.rating,
    isSelect: asset.is_select,
    tags: asset.tags,
    altText: asset.alt_text,
    capturedAt: asset.captured_at,
    createdAt: asset.created_at,
    url: signed.get(asset.storage_path) ?? null,
    isCover: coverAssetId === asset.id,
  }));
}

/**
 * Every tag used anywhere in this shoot, for the tag filter.
 *
 * Read separately from the (filtered, paginated) grid so filtering by one tag
 * does not remove the others from the dropdown. Narrow single-column read; the
 * cap keeps it bounded on very large shoots.
 */
export async function listShootTags(supabase: Db, shootId: string): Promise<string[]> {
  if (!isUuid(shootId)) return [];

  const { data, error } = await supabase
    .from('assets')
    .select('tags')
    .eq('shoot_id', shootId)
    .limit(1000);

  if (error || !data) return [];

  const tags = new Set<string>();
  for (const row of data) {
    for (const tag of row.tags) tags.add(tag);
  }

  return [...tags].sort((a, b) => a.localeCompare(b));
}

/** Totals for the shoot header, independent of the current grid filter. */
export async function getShootCounts(
  supabase: Db,
  shootId: string,
): Promise<{ total: number; selects: number }> {
  if (!isUuid(shootId)) return { total: 0, selects: 0 };

  const [total, selects] = await Promise.all([
    supabase
      .from('assets')
      .select('id', { count: 'exact', head: true })
      .eq('shoot_id', shootId),
    supabase
      .from('assets')
      .select('id', { count: 'exact', head: true })
      .eq('shoot_id', shootId)
      .eq('is_select', true),
  ]);

  return { total: total.count ?? 0, selects: selects.count ?? 0 };
}
