import type { ShootType } from '@lensello/core';
import type { Session } from '@/lib/auth';
import type { Tables } from '@/lib/db.types';
import { PHOTOS_BUCKET, PREVIEW_URL_TTL_SECONDS, signPhotoUrls } from '@/lib/campaigns/queries';
import { isLabelKind, isUuid, type LabelKind } from './constants';
import type { CandidateAsset, GeneratedImageView, ShortlistItemView } from './types';

/**
 * Read helpers for the studio module.
 *
 * Every function takes the caller's Supabase client, so every read runs under
 * their RLS context — nothing here reaches for the service role. `assets`,
 * `asset_ai_labels`, `gallery_sections`, and `campaigns` carry no PostgREST
 * relationships in `db.types.ts` (same as `lib/campaigns/queries.ts`), so this
 * does separate round trips and joins in memory rather than one embedded
 * select that would not typecheck.
 */

type Db = Session['supabase'];

export interface ShootOption {
  id: string;
  title: string;
  type: ShootType;
}

/** Shoots offered in the brief form's "narrow to one shoot" picker. */
export async function listShootOptions(db: Db): Promise<ShootOption[]> {
  const { data, error } = await db
    .from('shoots')
    .select('id, title, type')
    .neq('status', 'archived')
    .order('shot_at', { ascending: false, nullsFirst: false })
    .limit(200);

  if (error) throw new Error(`Could not load shoots: ${error.message}`);
  return (data ?? []).map((row) => ({ id: row.id, title: row.title, type: row.type as ShootType }));
}

/** Shoot types actually in use, so the interpreter only ever guesses at a real one. */
export async function listKnownShootTypes(db: Db): Promise<ShootType[]> {
  const { data, error } = await db.from('shoots').select('type').neq('status', 'archived').limit(500);
  if (error) return [];
  return [...new Set((data ?? []).map((row) => row.type as ShootType))];
}

// --- candidate search ------------------------------------------------------

const CANDIDATE_ROUND_TRIP_LIMIT = 400;

async function assetIdsByTagOverlap(
  db: Db,
  labels: readonly string[],
  shootId: string | null,
): Promise<Set<string>> {
  if (labels.length === 0) return new Set();

  let query = db.from('assets').select('id').overlaps('tags', [...labels]);
  if (shootId) query = query.eq('shoot_id', shootId);

  const { data, error } = await query.limit(CANDIDATE_ROUND_TRIP_LIMIT);
  if (error) return new Set();
  return new Set((data ?? []).map((row) => row.id));
}

async function assetIdsByLabel(db: Db, labels: readonly string[]): Promise<Set<string>> {
  if (labels.length === 0) return new Set();

  const { data, error } = await db
    .from('asset_ai_labels')
    .select('asset_id')
    .in('label', [...labels])
    .limit(CANDIDATE_ROUND_TRIP_LIMIT);

  if (error) return new Set();
  return new Set((data ?? []).map((row) => row.asset_id));
}

async function assetIdsByCaption(
  db: Db,
  labels: readonly string[],
  shootId: string | null,
): Promise<Set<string>> {
  const safe = labels.filter(safeForOrClause);
  if (safe.length === 0) return new Set();

  let query = db
    .from('assets')
    .select('id')
    .not('ai_caption', 'is', null)
    .or(safe.map((label) => `ai_caption.ilike.%${label}%`).join(','));
  if (shootId) query = query.eq('shoot_id', shootId);

  const { data, error } = await query.limit(CANDIDATE_ROUND_TRIP_LIMIT);
  if (error) return new Set();
  return new Set((data ?? []).map((row) => row.id));
}

/**
 * Labels reach here from the interpreted brief, which is model output (or a
 * heuristic parse) grounded in a photographer's free-text prompt — untrusted
 * input. `.in()`/`.overlaps()` bind values as parameters and are safe for any
 * text, but PostgREST's `.or()` filter syntax treats commas, dots, and
 * parentheses as *syntax*, not data. Rather than escape a mini query
 * language, only labels in this safe, ASCII, punctuation-free set are used to
 * build an `.or()` clause at all; anything else still matches through the
 * tag-overlap and label-table signals, which do not have this restriction.
 */
function safeForOrClause(label: string): boolean {
  return /^[a-z0-9 -]{1,40}$/.test(label);
}

/**
 * Asset ids reachable through a client-facing gallery section whose title or
 * blurb mentions one of the brief's labels — "pull out the gallery area" from
 * the client's own request, read literally.
 */
async function assetIdsByGallerySection(
  db: Db,
  labels: readonly string[],
  shootId: string | null,
): Promise<{ ids: Set<string>; titlesByAsset: Map<string, string[]> }> {
  const titlesByAsset = new Map<string, string[]>();
  const safe = labels.filter(safeForOrClause);
  if (safe.length === 0) return { ids: new Set(), titlesByAsset };

  let galleryQuery = db.from('galleries').select('id');
  if (shootId) galleryQuery = galleryQuery.eq('shoot_id', shootId);
  const { data: galleries } = await galleryQuery.limit(CANDIDATE_ROUND_TRIP_LIMIT);
  const galleryIds = (galleries ?? []).map((row) => row.id);
  if (galleryIds.length === 0) return { ids: new Set(), titlesByAsset };

  const orClause = safe
    .map((label) => `title.ilike.%${label}%,blurb.ilike.%${label}%`)
    .join(',');

  const { data: sections } = await db
    .from('gallery_sections')
    .select('id, title')
    .in('gallery_id', galleryIds)
    .or(orClause)
    .limit(CANDIDATE_ROUND_TRIP_LIMIT);

  const sectionIds = (sections ?? []).map((row) => row.id);
  if (sectionIds.length === 0) return { ids: new Set(), titlesByAsset };

  const titleBySection = new Map((sections ?? []).map((row) => [row.id, row.title] as const));

  const { data: sectionAssets } = await db
    .from('gallery_section_assets')
    .select('section_id, asset_id')
    .in('section_id', sectionIds)
    .limit(CANDIDATE_ROUND_TRIP_LIMIT);

  const ids = new Set<string>();
  for (const row of sectionAssets ?? []) {
    ids.add(row.asset_id);
    const title = titleBySection.get(row.section_id);
    if (!title) continue;
    const existing = titlesByAsset.get(row.asset_id) ?? [];
    existing.push(title);
    titlesByAsset.set(row.asset_id, existing);
  }

  return { ids, titlesByAsset };
}

/**
 * Every candidate photo worth scoring against the brief: matched by tag, by
 * an `asset_ai_labels` row, by the AI caption, or by a client gallery
 * section — unioned, then hydrated with everything `rankCandidates` needs.
 */
export async function findCandidateAssets(
  db: Db,
  labels: readonly string[],
  shootId: string | null,
): Promise<CandidateAsset[]> {
  const normalizedLabels = [...new Set(labels.map((label) => label.trim().toLowerCase()).filter(Boolean))];
  if (normalizedLabels.length === 0) return [];

  const [tagIds, labelIds, captionIds, gallerySections] = await Promise.all([
    assetIdsByTagOverlap(db, normalizedLabels, shootId),
    assetIdsByLabel(db, normalizedLabels),
    assetIdsByCaption(db, normalizedLabels, shootId),
    assetIdsByGallerySection(db, normalizedLabels, shootId),
  ]);

  const candidateIds = new Set<string>([...tagIds, ...labelIds, ...captionIds, ...gallerySections.ids]);
  if (candidateIds.size === 0) return [];

  const ids = [...candidateIds].slice(0, CANDIDATE_ROUND_TRIP_LIMIT);

  let assetQuery = db
    .from('assets')
    .select('id, tags, ai_caption, rating, is_select')
    .in('id', ids);
  if (shootId) assetQuery = assetQuery.eq('shoot_id', shootId);

  const { data: assets, error } = await assetQuery;
  if (error) throw new Error(`Could not load candidate photos: ${error.message}`);
  if (!assets || assets.length === 0) return [];

  const resolvedIds = assets.map((asset) => asset.id);

  const { data: labelRows } = await db
    .from('asset_ai_labels')
    .select('asset_id, label, kind, confidence')
    .in('asset_id', resolvedIds);

  const labelsByAsset = new Map<string, CandidateAsset['labels']>();
  for (const row of labelRows ?? []) {
    const list = labelsByAsset.get(row.asset_id) ?? [];
    list.push({
      label: row.label,
      kind: isLabelKind(row.kind) ? row.kind : ('subject' as LabelKind),
      confidence: row.confidence,
    });
    labelsByAsset.set(row.asset_id, list);
  }

  return assets.map((asset) => ({
    assetId: asset.id,
    tags: asset.tags,
    aiCaption: asset.ai_caption,
    labels: labelsByAsset.get(asset.id) ?? [],
    gallerySectionTitles: gallerySections.titlesByAsset.get(asset.id) ?? [],
    rating: asset.rating,
    isSelect: asset.is_select,
  }));
}

// --- requests ---------------------------------------------------------------

export async function listStudioRequests(db: Db, limit = 30): Promise<Tables<'studio_requests'>[]> {
  const { data, error } = await db
    .from('studio_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load studio requests: ${error.message}`);
  return data ?? [];
}

export async function getStudioRequest(db: Db, requestId: string): Promise<Tables<'studio_requests'> | null> {
  if (!isUuid(requestId)) return null;
  const { data, error } = await db.from('studio_requests').select('*').eq('id', requestId).maybeSingle();
  if (error) throw new Error(`Could not load that brief: ${error.message}`);
  return data;
}

/** Shortlist rows with signed photo URLs, ranked order. */
export async function getShortlist(db: Db, requestId: string): Promise<ShortlistItemView[]> {
  if (!isUuid(requestId)) return [];

  const { data: rows, error } = await db
    .from('studio_shortlist')
    .select('*')
    .eq('request_id', requestId)
    .order('rank', { ascending: true });
  if (error) throw new Error(`Could not load the shortlist: ${error.message}`);
  if (!rows || rows.length === 0) return [];

  const { data: assets } = await db
    .from('assets')
    .select('id, storage_path, filename, alt_text')
    .in('id', rows.map((row) => row.asset_id));

  const assetById = new Map((assets ?? []).map((asset) => [asset.id, asset] as const));
  const urls = await signPhotoUrls(
    db,
    (assets ?? []).map((asset) => asset.storage_path),
    PREVIEW_URL_TTL_SECONDS,
  );

  return rows.map((row) => {
    const asset = assetById.get(row.asset_id);
    return {
      id: row.id,
      assetId: row.asset_id,
      rank: row.rank,
      rationale: row.rationale,
      score: row.score,
      decision: row.decision,
      filename: asset?.filename ?? 'Deleted photo',
      altText: asset?.alt_text ?? null,
      url: asset ? urls.get(asset.storage_path) ?? null : null,
    };
  });
}

/** Generated images for one brief, newest first, with signed URLs. */
export async function getGeneratedImages(db: Db, requestId: string): Promise<GeneratedImageView[]> {
  if (!isUuid(requestId)) return [];

  const { data: rows, error } = await db
    .from('generated_images')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Could not load generated artwork: ${error.message}`);
  if (!rows || rows.length === 0) return [];

  const urls = await signPhotoUrls(db, rows.map((row) => row.storage_path), PREVIEW_URL_TTL_SECONDS);

  return rows.map((row) => ({
    id: row.id,
    prompt: row.prompt,
    provider: row.provider,
    model: row.model,
    width: row.width,
    height: row.height,
    decision: row.decision,
    assetId: row.asset_id,
    createdAt: row.created_at,
    url: urls.get(row.storage_path) ?? null,
  }));
}

export { PHOTOS_BUCKET };
