/**
 * Pure decision logic for the Drive import pipeline.
 *
 * Split out from `import-run.ts` — which does the actual Supabase and Drive
 * I/O — so that idempotency and resumability are testable as ordinary
 * function calls, not as an integration test against a database. This is the
 * same shape as `@/lib/clients/sync.ts`, which keeps `normalizeEmail` and
 * `inferSource` here-testable while the actual insert/upsert calls rely on a
 * Postgres unique constraint for the real guarantee.
 *
 * The real guarantees still live in SQL — `drive_import_jobs_folder_key` and
 * `drive_import_files_job_file_key` in `20260813140000_drive_import.sql` — this
 * module is what decides what to even attempt, given the two systems (Drive's
 * file listing, and this table's rows) can each independently be a step ahead
 * of the other.
 */

import { IMPORT_SHOOT_TITLE_PREFIX, MAX_IMPORT_ATTEMPTS, sanitiseFilename } from './constants';

export type ImportFileStatus = 'pending' | 'imported' | 'failed';

export interface ImportFileRecord {
  driveFileId: string;
  status: ImportFileStatus;
  attempts: number;
}

/**
 * The storage path one Drive file always maps to, for one shoot.
 *
 * Deterministic by construction: re-importing the same file computes the same
 * path every time, so a re-upload overwrites the same Storage object instead
 * of creating a second one, and `assets.storage_path` (unique) turns a repeat
 * insert into a no-op via `ON CONFLICT`. This is what makes an *upload*
 * idempotent even before the `drive_import_files` bookkeeping is consulted at
 * all.
 */
export function buildImportStoragePath(
  shootId: string,
  driveFileId: string,
  name: string,
): string {
  return `shoots/${shootId}/drive-${driveFileId}-${sanitiseFilename(name)}`;
}

/**
 * Which of the requested Drive file ids are not already tracked for this job.
 *
 * The unique `(job_id, drive_file_id)` constraint is the actual guarantee —
 * this only decides which rows are worth attempting to insert, so selecting
 * the same folder (and the same files within it) twice does not even reach
 * the database for files it already knows about. Also de-duplicates the
 * input itself, since a browser can submit the same checkbox id twice.
 */
export function selectNewFileIds(
  alreadyTracked: ReadonlySet<string>,
  requested: readonly string[],
): string[] {
  const seen = new Set<string>();
  const fresh: string[] = [];

  for (const id of requested) {
    if (alreadyTracked.has(id) || seen.has(id)) continue;
    seen.add(id);
    fresh.push(id);
  }

  return fresh;
}

/**
 * Which files the next batch should attempt.
 *
 * Never an already-`imported` file — that is the idempotency half of this
 * module. Never a `failed` file that has exhausted its retries — that is what
 * stops a permanently broken file being retried forever every time someone
 * reopens the folder. Everything else, oldest-selected first, capped at
 * `limit` — that is the resumability half: calling this again with the same
 * `files` (minus whatever the previous batch just resolved) is exactly how a
 * resumed import continues rather than restarts.
 */
export function selectFilesToProcess<T extends ImportFileRecord>(
  files: readonly T[],
  limit: number,
  maxAttempts = MAX_IMPORT_ATTEMPTS,
): T[] {
  return files
    .filter(
      (file) =>
        file.status === 'pending' || (file.status === 'failed' && file.attempts < maxAttempts),
    )
    .slice(0, Math.max(0, limit));
}

export interface ImportCounts {
  total: number;
  imported: number;
  /** Failed, whether or not it is still eligible for an automatic retry. */
  failed: number;
  pending: number;
}

export function summarizeCounts(files: readonly Pick<ImportFileRecord, 'status'>[]): ImportCounts {
  let imported = 0;
  let failed = 0;
  let pending = 0;

  for (const file of files) {
    if (file.status === 'imported') imported += 1;
    else if (file.status === 'failed') failed += 1;
    else pending += 1;
  }

  return { total: files.length, imported, failed, pending };
}

export type ImportJobStatus = 'pending' | 'running' | 'completed' | 'completed_with_errors';

/**
 * The job's overall status, derived from its files rather than tracked by
 * hand — so it can never drift from what actually happened to the rows.
 *
 * `hasRetryable` is passed in rather than recomputed from `counts` because it
 * depends on the retry cap (`attempts` vs `MAX_IMPORT_ATTEMPTS`), which
 * `ImportCounts` deliberately does not carry — a job with only
 * retry-exhausted failures left is done resuming even though its `failed`
 * count is identical to one that still has retries available.
 */
export function nextJobStatus(counts: ImportCounts, hasRetryable: boolean): ImportJobStatus {
  if (counts.total === 0) return 'pending';
  if (counts.imported === counts.total) return 'completed';
  if (counts.pending === 0 && !hasRetryable) return 'completed_with_errors';
  return 'running';
}

// --- shoot + tag naming ----------------------------------------------------

/**
 * The title every import shoot gets. Prefixed consistently so "this is
 * imported, not a client shoot" reads at a glance in the main Library index —
 * a module this one does not own and cannot add a badge to.
 */
export function buildImportShootTitle(driveFolderName: string): string {
  const trimmed = driveFolderName.trim();
  return `${IMPORT_SHOOT_TITLE_PREFIX}${trimmed.length > 0 ? trimmed : 'Untitled Drive folder'}`;
}

/** The shoot's `notes`, spelling out where the photographs came from and what they are not. */
export function buildImportShootNotes(driveFolderId: string, driveFolderName: string): string {
  return (
    `Imported from the Google Drive folder "${driveFolderName}" (id ${driveFolderId}). ` +
    'In-house or personal photography, not a client shoot — do not attach it to a client gallery.'
  );
}

/** A tag every photo from one folder gets, so a studio search for the folder's subject finds them. */
export function deriveFolderTag(driveFolderName: string): string {
  const tag = driveFolderName
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);

  return tag.length > 0 ? tag : 'drive-import';
}
