import { summarize, type AdMetric, type AdPerformance } from '@lensello/core';
import type { Session } from '@/lib/auth';
import type { Tables } from '@/lib/db.types';
import {
  CREATIVE_PICKER_LIMIT,
  PREVIEW_URL_TTL_SECONDS,
} from './constants';
import type { AdFilters } from './schema';

/**
 * Read helpers for the ads module.
 *
 * Every function takes the caller's `supabase` client, so reads run under their
 * RLS context — there is no ambient client here that could be pointed at the
 * service role by accident.
 */

type SupabaseClient = Session['supabase'];

export type AdRow = Tables<'ads'>;
export type AdMetricRow = Tables<'ad_metrics'>;

/**
 * Database rows are snake_case; `summarize()` and the rest of `@lensello/core`
 * speak camelCase. One mapper, used everywhere, so no roll-up ever reads
 * `row.spend_cents` and quietly gets `undefined` in the arithmetic.
 */
export function toAdMetric(row: AdMetricRow): AdMetric {
  return {
    id: row.id,
    adId: row.ad_id,
    day: row.day,
    impressions: row.impressions,
    clicks: row.clicks,
    spendCents: row.spend_cents,
    leads: row.leads,
  };
}

export interface AdWithPerformance {
  ad: AdRow;
  performance: AdPerformance;
}

/** Groups metrics by ad id in one pass. */
function groupByAd(metrics: readonly AdMetric[]): Map<string, AdMetric[]> {
  const groups = new Map<string, AdMetric[]>();
  for (const metric of metrics) {
    const existing = groups.get(metric.adId);
    if (existing) existing.push(metric);
    else groups.set(metric.adId, [metric]);
  }
  return groups;
}

/**
 * The /ads index read: ads matching the filters, each with its lifetime
 * roll-up.
 *
 * Status and platform filter in SQL. Sorting does not: spend and leads are
 * derived by `summarize()`, not stored columns, so ordering has to happen after
 * the roll-up. A stable secondary sort on name keeps ties from shuffling
 * between renders.
 */
export async function listAdsWithPerformance(
  supabase: SupabaseClient,
  filters: AdFilters,
): Promise<{ rows: AdWithPerformance[]; error: string | null }> {
  let query = supabase.from('ads').select('*');

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.platform) query = query.eq('platform', filters.platform);

  const { data: ads, error: adsError } = await query.order('created_at', {
    ascending: false,
  });

  if (adsError) {
    return { rows: [], error: 'Could not load ads. Try reloading the page.' };
  }
  if (!ads || ads.length === 0) {
    return { rows: [], error: null };
  }

  const { data: metrics, error: metricsError } = await supabase
    .from('ad_metrics')
    .select('*')
    .in(
      'ad_id',
      ads.map((ad) => ad.id),
    );

  if (metricsError) {
    return {
      rows: [],
      error: 'Could not load ad performance. Try reloading the page.',
    };
  }

  const groups = groupByAd((metrics ?? []).map(toAdMetric));

  const rows: AdWithPerformance[] = ads.map((ad) => ({
    ad,
    // `summarize` filters by ad id internally; passing the pre-grouped rows
    // makes that a no-op instead of a scan of every metric per ad.
    performance: summarize(groups.get(ad.id) ?? [], ad.id),
  }));

  const direction = filters.dir === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    const left =
      filters.sort === 'leads' ? a.performance.leads : a.performance.spendCents;
    const right =
      filters.sort === 'leads' ? b.performance.leads : b.performance.spendCents;
    if (left !== right) return (left - right) * direction;
    return a.ad.name.localeCompare(b.ad.name);
  });

  return { rows, error: null };
}

/** A roll-up across a set of ads, for the header stat row. */
export function summarizeAll(rows: readonly AdWithPerformance[]): AdPerformance {
  const totals = rows.reduce(
    (acc, row) => {
      acc.impressions += row.performance.impressions;
      acc.clicks += row.performance.clicks;
      acc.spendCents += row.performance.spendCents;
      acc.leads += row.performance.leads;
      return acc;
    },
    { impressions: 0, clicks: 0, spendCents: 0, leads: 0 },
  );

  // Re-derive the ratios through `summarize()` rather than averaging the
  // per-ad CTRs: the mean of ratios is not the ratio of the sums, and the
  // difference is large enough to change a decision.
  return summarize(
    [
      {
        id: 'aggregate',
        adId: 'aggregate',
        day: '1970-01-01',
        ...totals,
      },
    ],
    'aggregate',
  );
}

export async function getAd(
  supabase: SupabaseClient,
  adId: string,
): Promise<AdRow | null> {
  const { data } = await supabase
    .from('ads')
    .select('*')
    .eq('id', adId)
    .maybeSingle();

  return data ?? null;
}

/** Daily rows for one ad, oldest first — the order both the table and chart want. */
export async function listAdMetrics(
  supabase: SupabaseClient,
  adId: string,
): Promise<AdMetric[]> {
  const { data } = await supabase
    .from('ad_metrics')
    .select('*')
    .eq('ad_id', adId)
    .order('day', { ascending: true });

  return (data ?? []).map(toAdMetric);
}

// --- options for the ad form -------------------------------------------

export interface CampaignOption {
  id: string;
  name: string;
  status: string;
}

/**
 * Marketing campaigns an ad can be attached to. Read-only use of the campaigns
 * module's table — archived ones are excluded because linking a new ad to a
 * finished campaign is almost always a mis-click.
 */
export async function listCampaignOptions(
  supabase: SupabaseClient,
): Promise<CampaignOption[]> {
  const { data } = await supabase
    .from('campaigns')
    .select('id, name, status')
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(100);

  return data ?? [];
}

export interface CreativeChoice {
  id: string;
  filename: string;
  altText: string | null;
  shootTitle: string;
  /** Signed, short-lived. The `photos` bucket is private. */
  previewUrl: string | null;
}

export interface CreativeGroup {
  shootTitle: string;
  choices: CreativeChoice[];
}

interface AssetJoinRow {
  id: string;
  storage_path: string;
  filename: string;
  alt_text: string | null;
  is_select: boolean;
  created_at: string;
  shoots: { title: string } | { title: string }[] | null;
}

function shootTitleOf(row: AssetJoinRow): string {
  const shoots = row.shoots;
  if (!shoots) return 'Unfiled';
  const first = Array.isArray(shoots) ? shoots[0] : shoots;
  return first?.title ?? 'Unfiled';
}

/**
 * Photos offered as ad creative, grouped by shoot.
 *
 * Portfolio selects first — those are the frames already judged good enough to
 * show a client, which is exactly the bar for a paid creative. Previews are
 * server-generated signed URLs: the `photos` bucket is private, so a raw
 * storage path renders as a broken image, and making the bucket public to fix
 * that would expose every client's gallery.
 */
export async function listCreativeChoices(
  supabase: SupabaseClient,
  options: { includeAssetId?: string | null } = {},
): Promise<CreativeGroup[]> {
  const { data } = await supabase
    .from('assets')
    .select('id, storage_path, filename, alt_text, is_select, created_at, shoots(title)')
    .order('is_select', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(CREATIVE_PICKER_LIMIT);

  const rows = (data ?? []) as unknown as AssetJoinRow[];

  // The ad's current creative might be older than the newest 48 photos. Fetch
  // it explicitly so editing an ad never silently clears its own image.
  const currentId = options.includeAssetId;
  if (currentId && !rows.some((row) => row.id === currentId)) {
    const { data: current } = await supabase
      .from('assets')
      .select('id, storage_path, filename, alt_text, is_select, created_at, shoots(title)')
      .eq('id', currentId)
      .maybeSingle();

    if (current) rows.unshift(current as unknown as AssetJoinRow);
  }

  if (rows.length === 0) return [];

  const signedByPath = await signPaths(
    supabase,
    rows.map((row) => row.storage_path),
    PREVIEW_URL_TTL_SECONDS,
  );

  const groups = new Map<string, CreativeChoice[]>();
  for (const row of rows) {
    const shootTitle = shootTitleOf(row);
    const choice: CreativeChoice = {
      id: row.id,
      filename: row.filename,
      altText: row.alt_text,
      shootTitle,
      previewUrl: signedByPath.get(row.storage_path) ?? null,
    };
    const existing = groups.get(shootTitle);
    if (existing) existing.push(choice);
    else groups.set(shootTitle, [choice]);
  }

  return [...groups.entries()].map(([shootTitle, choices]) => ({
    shootTitle,
    choices,
  }));
}

/**
 * Batch-signs storage paths. One request for the whole grid rather than one per
 * thumbnail, which at 48 photos is the difference between a page and a stall.
 */
export async function signPaths(
  supabase: SupabaseClient,
  paths: readonly string[],
  expiresIn: number,
): Promise<Map<string, string>> {
  const signed = new Map<string, string>();
  const unique = [...new Set(paths)];
  if (unique.length === 0) return signed;

  const { data, error } = await supabase.storage
    .from('photos')
    .createSignedUrls(unique, expiresIn);

  // A signing failure is a degraded preview, not a broken page: callers render
  // a placeholder for a null URL.
  if (error || !data) return signed;

  for (const entry of data) {
    if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
  }
  return signed;
}

export interface AdCreative {
  assetId: string;
  filename: string;
  altText: string | null;
  url: string | null;
}

/** The signed URL for one ad's creative — used by the feed preview and by launch. */
export async function getAdCreative(
  supabase: SupabaseClient,
  assetId: string | null,
  expiresIn: number = PREVIEW_URL_TTL_SECONDS,
): Promise<AdCreative | null> {
  if (!assetId) return null;

  const { data } = await supabase
    .from('assets')
    .select('id, storage_path, filename, alt_text')
    .eq('id', assetId)
    .maybeSingle();

  if (!data) return null;

  const { data: signed } = await supabase.storage
    .from('photos')
    .createSignedUrl(data.storage_path, expiresIn);

  return {
    assetId: data.id,
    filename: data.filename,
    altText: data.alt_text,
    url: signed?.signedUrl ?? null,
  };
}

/** Shoot types present in the library, so the copy generator offers real options. */
export async function listShootTypesInUse(
  supabase: SupabaseClient,
): Promise<string[]> {
  const { data } = await supabase.from('shoots').select('type').limit(500);
  return [...new Set((data ?? []).map((row) => row.type))];
}
