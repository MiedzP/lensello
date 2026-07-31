import {
  SHOOT_STATUSES,
  SHOOT_TYPES,
  type ShootStatus,
  type ShootType,
} from '@lensello/core';
import type { Tone } from '@/components/ui';

/**
 * Library vocabulary, storage rules, and pure helpers.
 *
 * Imported by both Server and Client Components, so this file must stay free of
 * server-only imports (no `cookies()`, no Supabase server client).
 */

// --- storage -------------------------------------------------------------

export const PHOTOS_BUCKET = 'photos';

/** Mirrors `allowed_mime_types` on the `photos` bucket in 20260731150000_init.sql. */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/tiff',
] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/** Mirrors `file_size_limit` on the `photos` bucket: 100 MB. */
export const MAX_UPLOAD_BYTES = 104_857_600;

/**
 * Signed URL lifetime. Long enough to browse a shoot without re-signing on
 * every interaction, short enough that a copied URL is not a permanent leak.
 */
export const SIGNED_URL_TTL_SECONDS = 60 * 30;

/** The `accept` attribute for the file picker, derived from the bucket rules. */
export const UPLOAD_ACCEPT = ALLOWED_MIME_TYPES.join(',');

export function isAllowedMimeType(value: string): value is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Reduces a client-supplied filename to something safe to concatenate into a
 * storage key.
 *
 * A raw filename is attacker-controlled: it can contain `../`, a leading `/`,
 * NUL bytes, or unicode that normalises into a separator. Rather than blocklist
 * those, keep only `[A-Za-z0-9._-]` and strip leading dots and dashes, which
 * makes both path traversal and a hidden-file name unrepresentable.
 */
export function sanitiseFilename(raw: string): string {
  const basename = raw.split(/[\\/]/).pop() ?? '';

  const safe = basename
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[.\-]+/, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 96);

  return safe.length > 0 ? safe : 'photo';
}

/** `shoots/<shootId>/<uuid>-<sanitised filename>`. */
export function buildStoragePath(shootId: string, filename: string): string {
  return `shoots/${shootId}/${crypto.randomUUID()}-${sanitiseFilename(filename)}`;
}

/**
 * Server-side guard: a storage path arriving from the browser must sit directly
 * under this shoot's prefix and must not contain a further separator.
 */
export function isStoragePathForShoot(path: unknown, shootId: string): path is string {
  if (typeof path !== 'string' || !isUuid(shootId)) return false;

  const prefix = `shoots/${shootId}/`;
  if (!path.startsWith(prefix)) return false;

  const leaf = path.slice(prefix.length);
  return leaf.length > 0 && leaf.length <= 160 && /^[A-Za-z0-9._-]+$/.test(leaf);
}

// --- shoot vocabulary ----------------------------------------------------

export const SHOOT_STATUS_LABELS: Record<ShootStatus, string> = {
  planned: 'Planned',
  shot: 'Shot',
  culling: 'Culling',
  editing: 'Editing',
  delivered: 'Delivered',
  archived: 'Archived',
};

export const SHOOT_STATUS_TONES: Record<ShootStatus, Tone> = {
  planned: 'neutral',
  shot: 'accent',
  culling: 'warning',
  editing: 'warning',
  delivered: 'success',
  archived: 'neutral',
};

export function isShootStatus(value: unknown): value is ShootStatus {
  return typeof value === 'string' && (SHOOT_STATUSES as readonly string[]).includes(value);
}

export function isShootType(value: unknown): value is ShootType {
  return typeof value === 'string' && (SHOOT_TYPES as readonly string[]).includes(value);
}

// --- list controls -------------------------------------------------------

export const SHOOT_SORTS = ['date_desc', 'date_asc', 'added_desc', 'title_asc'] as const;
export type ShootSort = (typeof SHOOT_SORTS)[number];

export const SHOOT_SORT_LABELS: Record<ShootSort, string> = {
  date_desc: 'Shot date, newest first',
  date_asc: 'Shot date, oldest first',
  added_desc: 'Recently added',
  title_asc: 'Title, A–Z',
};

export const DEFAULT_SHOOT_SORT: ShootSort = 'date_desc';

export function isShootSort(value: unknown): value is ShootSort {
  return typeof value === 'string' && (SHOOT_SORTS as readonly string[]).includes(value);
}

export const ASSET_SORTS = ['added_desc', 'added_asc', 'rating_desc'] as const;
export type AssetSort = (typeof ASSET_SORTS)[number];

export const ASSET_SORT_LABELS: Record<AssetSort, string> = {
  added_desc: 'Newest first',
  added_asc: 'Oldest first',
  rating_desc: 'Highest rated',
};

export const DEFAULT_ASSET_SORT: AssetSort = 'added_desc';

export function isAssetSort(value: unknown): value is AssetSort {
  return typeof value === 'string' && (ASSET_SORTS as readonly string[]).includes(value);
}

/** How many shoots one index page shows. */
export const SHOOTS_PAGE_SIZE = 60;

/** Upper bound on assets rendered in one grid, so a 10k shoot cannot hang the page. */
export const ASSETS_PAGE_SIZE = 200;

// --- formatting ----------------------------------------------------------

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

/**
 * `2026-07-31T…` → `Jul 31, 2026`. Null-safe for undated shoots.
 *
 * Formatted in UTC on purpose. These strings are rendered both during SSR and
 * during hydration, and a server in UTC formatting against a browser five hours
 * behind it would disagree about the day — a hydration mismatch that only shows
 * up in some timezones. Shoot dates are written anchored at midday UTC (see
 * `toTimestamp` in the module's actions), so the UTC calendar day is the day the
 * photographer picked.
 */
export function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** `timestamptz` → the `YYYY-MM-DD` an `<input type="date">` expects. */
export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toISOString().slice(0, 10);
}
