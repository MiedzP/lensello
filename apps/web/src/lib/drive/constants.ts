/**
 * Drive import vocabulary and limits.
 *
 * Module-private by convention, the way `campaigns/queries.ts` keeps its own
 * `PHOTOS_BUCKET` rather than importing the library module's copy: a handful
 * of overlapping constants is cheaper than a cross-module dependency.
 */

export const PHOTOS_BUCKET = 'photos';

/**
 * Every import shoot uses the same type and status. `event` reads honestly
 * for both fixtures in the client's brief — in-house speech reels and a
 * family album are neither of them a `wedding` or `portrait` shoot the studio
 * booked — and `shot` (rather than `planned`) because the photography already
 * happened; there is nothing left to schedule.
 */
export const IMPORT_SHOOT_TYPE = 'event' as const;
export const IMPORT_SHOOT_STATUS = 'shot' as const;

/**
 * Prefixes every shoot an import creates, so "this is imported, not a client
 * shoot" is visible wherever shoots are listed — including the main Library
 * index, which this module does not own and cannot add a badge to.
 */
export const IMPORT_SHOOT_TITLE_PREFIX = 'Imported — ';

/** Files processed per batch call. Keeps one Server Action invocation short. */
export const BATCH_FILE_LIMIT = 8;

/** Wall-clock budget per batch call, in milliseconds. */
export const BATCH_TIME_BUDGET_MS = 8_000;

/** A file stops being retried automatically once it has failed this many times. */
export const MAX_IMPORT_ATTEMPTS = 5;

/** Upper bound on files selectable from one folder in a single "start import" call. */
export const MAX_FILES_PER_SELECTION = 500;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Drive file/folder ids are opaque tokens Google assigns — not UUIDs, no fixed
 * shape is documented. Validated only enough to keep obviously-wrong input
 * (empty, absurdly long, containing whitespace) out of a query string.
 */
export function isPlausibleDriveId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 && !/\s/.test(value);
}

export function isImageMimeType(value: string): boolean {
  return value.startsWith('image/');
}

/**
 * Reduces a Drive filename to something safe to concatenate into a storage
 * key. Mirrors `@/lib/library/constants`' `sanitiseFilename` — kept as its own
 * copy for the same module-boundary reason as `PHOTOS_BUCKET` above.
 */
export function sanitiseFilename(raw: string): string {
  const basename = raw.split(/[\\/]/).pop() ?? '';

  const safe = basename
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[.-]+/, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 96);

  return safe.length > 0 ? safe : 'photo';
}
