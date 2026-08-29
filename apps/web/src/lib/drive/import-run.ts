/**
 * The Drive import engine: turning a folder + a selection of file ids into
 * rows in `assets`, resumably and idempotently.
 *
 * The decisions ("which files to attempt next", "is this job done", "what
 * storage path does this file always get") are pure functions in
 * `import-plan.ts`, unit tested there without touching a database. This
 * module is the I/O around them — Drive downloads, Storage uploads, and the
 * `drive_import_jobs` / `drive_import_files` bookkeeping — following the
 * same "adapter only, never fetch() directly" rule as every other
 * integration: all Drive access goes through `getDriveSource()`.
 *
 * Every exported function here takes the caller's Supabase client
 * (`requireUser()`'s, from the Server Action that calls it) and runs under
 * that user's RLS context. Nothing here uses the service-role key.
 */

import { getDriveSource } from '@lensello/core/integrations';
import type { Session } from '@/lib/auth';
import type { Tables, TablesInsert } from '@/lib/db.types';
import { asImportFileStatus } from '@/lib/validators';
import {
  BATCH_FILE_LIMIT,
  BATCH_TIME_BUDGET_MS,
  IMPORT_SHOOT_STATUS,
  IMPORT_SHOOT_TYPE,
  MAX_IMPORT_ATTEMPTS,
  PHOTOS_BUCKET,
  isImageMimeType,
} from './constants';
import {
  buildImportShootNotes,
  buildImportShootTitle,
  buildImportStoragePath,
  deriveFolderTag,
  nextJobStatus,
  selectFilesToProcess,
  selectNewFileIds,
  summarizeCounts,
  type ImportFileStatus,
} from './import-plan';
import type { JobView } from './queries';

type Db = Session['supabase'];

// --- starting / extending a job --------------------------------------------

export interface EnsureJobResult {
  job: JobView;
  /** True the first time this folder is ever imported from. */
  createdShoot: boolean;
}

function toJobView(row: Tables<'drive_import_jobs'>): JobView {
  return {
    id: row.id,
    driveFolderId: row.drive_folder_id,
    driveFolderName: row.drive_folder_name,
    shootId: row.shoot_id,
    status: row.status,
    totalFiles: row.total_files,
    importedFiles: row.imported_files,
    failedFiles: row.failed_files,
    createdAt: row.created_at,
  };
}

/**
 * Finds or creates the job (and, on first creation, the shoot) for one Drive
 * folder. `drive_import_jobs_folder_key` (unique on `drive_folder_id`) is
 * what makes this safe under a race — two concurrent calls both trying to
 * create the job for the same folder leave exactly one row, and the loser
 * simply reads back what the winner created.
 */
export async function ensureImportJob(
  supabase: Db,
  input: { driveFolderId: string; driveFolderName: string; createdBy: string },
): Promise<EnsureJobResult> {
  const { data: existingRow, error: findError } = await supabase
    .from('drive_import_jobs')
    .select('*')
    .eq('drive_folder_id', input.driveFolderId)
    .maybeSingle();

  if (findError) throw new Error(`Could not check for an existing import job: ${findError.message}`);
  if (existingRow) return { job: toJobView(existingRow), createdShoot: false };

  const { data: shoot, error: shootError } = await supabase
    .from('shoots')
    .insert({
      title: buildImportShootTitle(input.driveFolderName),
      type: IMPORT_SHOOT_TYPE,
      status: IMPORT_SHOOT_STATUS,
      notes: buildImportShootNotes(input.driveFolderId, input.driveFolderName),
    })
    .select('id')
    .single();

  if (shootError || !shoot) {
    throw new Error(
      `Could not create the import shoot: ${shootError?.message ?? 'no row returned'}`,
    );
  }

  const { data: inserted, error: insertError } = await supabase
    .from('drive_import_jobs')
    .insert({
      drive_folder_id: input.driveFolderId,
      drive_folder_name: input.driveFolderName,
      shoot_id: shoot.id,
      created_by: input.createdBy,
    })
    .select('*')
    // Another request may have won the race between the find above and this
    // insert. `ignoreDuplicates` on the folder key makes that a no-op here...
    .maybeSingle();

  if (insertError) {
    // ...but a plain insert still throws on the unique violation rather than
    // silently skipping, so the race is handled by re-reading instead.
    const { data: raced, error: racedError } = await supabase
      .from('drive_import_jobs')
      .select('*')
      .eq('drive_folder_id', input.driveFolderId)
      .maybeSingle();

    if (racedError || !raced) {
      throw new Error(`Could not create the import job: ${insertError.message}`);
    }
    return { job: toJobView(raced), createdShoot: false };
  }

  if (!inserted) {
    throw new Error('Could not create the import job: no row returned.');
  }

  return { job: toJobView(inserted), createdShoot: true };
}

export interface AddFilesResult {
  added: number;
  job: JobView;
}

/**
 * Tracks a batch of selected Drive files against a job.
 *
 * Idempotent at two levels: `selectNewFileIds` (in `import-plan.ts`) skips
 * anything this job already knows about before a query is even built, and
 * `drive_import_files_job_file_key` catches anything that slips through a
 * race between two concurrent calls. Metadata (name, mime type, size,
 * dimensions) is re-fetched from Drive here rather than trusted from the
 * caller — the browse page already has it, but a Server Action must not take
 * a client's word for a file's size or type.
 */
export async function addFilesToJob(
  supabase: Db,
  input: { jobId: string; driveFolderId: string; fileIds: readonly string[] },
): Promise<AddFilesResult> {
  const { data: trackedRows, error: trackedError } = await supabase
    .from('drive_import_files')
    .select('drive_file_id')
    .eq('job_id', input.jobId);

  if (trackedError) throw new Error(`Could not check tracked files: ${trackedError.message}`);

  const tracked = new Set((trackedRows ?? []).map((row) => row.drive_file_id));
  const newIds = selectNewFileIds(tracked, input.fileIds);

  if (newIds.length > 0) {
    const images = await getDriveSource().listImages(input.driveFolderId);
    const byId = new Map(images.map((image) => [image.id, image]));

    const rows: TablesInsert<'drive_import_files'>[] = newIds.flatMap((fileId) => {
      const image = byId.get(fileId);
      // The file vanished from Drive (deleted, unshared) between the browse
      // page rendering and this call. Skipped rather than failing the whole
      // batch — the rest of the selection still deserves to import.
      if (!image) return [];
      return [
        {
          job_id: input.jobId,
          drive_file_id: image.id,
          name: image.name,
          mime_type: image.mimeType,
          byte_size: image.byteSize,
          width: image.width,
          height: image.height,
          modified_time: image.modifiedTime,
        },
      ];
    });

    if (rows.length > 0) {
      const { error: insertError } = await supabase
        .from('drive_import_files')
        .upsert(rows, { onConflict: 'job_id,drive_file_id', ignoreDuplicates: true });

      if (insertError) throw new Error(`Could not track the selected files: ${insertError.message}`);
    }
  }

  const { count, error: countError } = await supabase
    .from('drive_import_files')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', input.jobId);

  if (countError) throw new Error(`Could not update the job total: ${countError.message}`);

  const { data: updatedJob, error: updateError } = await supabase
    .from('drive_import_jobs')
    .update({ total_files: count ?? 0 })
    .eq('id', input.jobId)
    .select('*')
    .single();

  if (updateError || !updatedJob) {
    throw new Error(`Could not update the job total: ${updateError?.message ?? 'no row returned'}`);
  }

  return { added: newIds.length, job: toJobView(updatedJob) };
}

// --- running a batch --------------------------------------------------------

interface FileRow {
  id: string;
  driveFileId: string;
  name: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  modifiedTime: string | null;
  status: ImportFileStatus;
  attempts: number;
}

export interface RunBatchResult {
  /** Files this call attempted (successfully or not). */
  processed: number;
  imported: number;
  failed: number;
  /** True once the job has nothing left to attempt, automatically or otherwise. */
  done: boolean;
  job: JobView;
}

/**
 * Attempts up to `limit` outstanding files, stopping early once `timeBudgetMs`
 * has elapsed. Call it again with the same `jobId` to continue — that is the
 * entire resume story: nothing distinguishes "the first batch" from "the
 * fifth batch after the tab was closed and reopened" except which files
 * `selectFilesToProcess` still finds eligible.
 */
export async function runImportBatch(
  supabase: Db,
  input: { jobId: string; limit?: number; timeBudgetMs?: number },
): Promise<RunBatchResult> {
  const limit = input.limit ?? BATCH_FILE_LIMIT;
  const timeBudgetMs = input.timeBudgetMs ?? BATCH_TIME_BUDGET_MS;

  const { data: jobRow, error: jobError } = await supabase
    .from('drive_import_jobs')
    .select('*')
    .eq('id', input.jobId)
    .maybeSingle();

  if (jobError) throw new Error(`Could not load the import job: ${jobError.message}`);
  if (!jobRow) throw new Error('That import job no longer exists.');

  // Filtered to `pending`/`failed` at the query level — this is
  // `drive_import_files_pending_idx` — since an already-imported file is
  // never a candidate and there is no reason to pull it over the wire every
  // batch of a folder that is mostly done.
  const { data: fileRows, error: filesError } = await supabase
    .from('drive_import_files')
    .select('id, drive_file_id, name, mime_type, width, height, modified_time, status, attempts')
    .eq('job_id', input.jobId)
    .in('status', ['pending', 'failed'])
    .order('created_at', { ascending: true });

  if (filesError) throw new Error(`Could not load the files to import: ${filesError.message}`);

  const rows: FileRow[] = (fileRows ?? []).map((row) => ({
    id: row.id,
    driveFileId: row.drive_file_id,
    name: row.name,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    modifiedTime: row.modified_time,
    status: asImportFileStatus(row.status),
    attempts: row.attempts,
  }));

  const candidates = selectFilesToProcess(
    rows.map((row) => ({ driveFileId: row.driveFileId, status: row.status, attempts: row.attempts })),
    limit,
  );
  const candidateIds = new Set(candidates.map((c) => c.driveFileId));
  const toProcess = rows.filter((row) => candidateIds.has(row.driveFileId));

  const driveSource = getDriveSource();
  const folderTag = deriveFolderTag(jobRow.drive_folder_name);

  const startedAt = Date.now();
  let processed = 0;
  let imported = 0;
  let failed = 0;

  for (const file of toProcess) {
    if (Date.now() - startedAt > timeBudgetMs) break;
    processed += 1;

    try {
      const downloaded = await driveSource.downloadFile(file.driveFileId);
      const mimeType = isImageMimeType(downloaded.mimeType) ? downloaded.mimeType : file.mimeType;

      if (!isImageMimeType(mimeType)) {
        throw new Error(`"${file.name}" is not an image (${mimeType}).`);
      }

      const storagePath = buildImportStoragePath(jobRow.shoot_id, file.driveFileId, file.name);

      const { error: uploadError } = await supabase.storage
        .from(PHOTOS_BUCKET)
        .upload(storagePath, downloaded.bytes, { contentType: mimeType, upsert: true });

      if (uploadError) throw new Error(uploadError.message);

      const { data: asset, error: assetError } = await supabase
        .from('assets')
        .upsert(
          {
            shoot_id: jobRow.shoot_id,
            storage_path: storagePath,
            filename: file.name,
            mime_type: mimeType,
            byte_size: downloaded.bytes.byteLength,
            width: file.width,
            height: file.height,
            captured_at: file.modifiedTime,
            tags: [folderTag],
          },
          { onConflict: 'storage_path' },
        )
        .select('id')
        .single();

      if (assetError || !asset) {
        throw new Error(assetError?.message ?? 'The photo record could not be saved.');
      }

      // Conditional on status: if another batch (a second tab) already
      // finished this exact file since we read it above, this update matches
      // zero rows rather than overwriting a result that is already correct.
      await supabase
        .from('drive_import_files')
        .update({ status: 'imported', asset_id: asset.id, error: null })
        .eq('id', file.id)
        .in('status', ['pending', 'failed']);

      imported += 1;
    } catch (cause) {
      const message = (cause instanceof Error ? cause.message : 'Import failed.').slice(0, 500);
      await supabase
        .from('drive_import_files')
        .update({ status: 'failed', error: message, attempts: file.attempts + 1 })
        .eq('id', file.id)
        .in('status', ['pending', 'failed']);
      failed += 1;
    }
  }

  const { data: finalRows, error: finalError } = await supabase
    .from('drive_import_files')
    .select('status, attempts')
    .eq('job_id', input.jobId);

  if (finalError) throw new Error(`Could not re-check import progress: ${finalError.message}`);

  const validatedFinalRows = (finalRows ?? []).map((row) => ({
    ...row,
    status: asImportFileStatus(row.status),
  }));

  const counts = summarizeCounts(validatedFinalRows);
  const hasRetryable = validatedFinalRows.some(
    (row) => row.status === 'failed' && row.attempts < MAX_IMPORT_ATTEMPTS,
  );
  const status = nextJobStatus(counts, hasRetryable);

  const { data: updatedJob, error: updateJobError } = await supabase
    .from('drive_import_jobs')
    .update({ status, imported_files: counts.imported, failed_files: counts.failed })
    .eq('id', input.jobId)
    .select('*')
    .single();

  if (updateJobError || !updatedJob) {
    throw new Error(`Could not update the import job: ${updateJobError?.message ?? 'no row returned'}`);
  }

  return {
    processed,
    imported,
    failed,
    done: status === 'completed' || status === 'completed_with_errors',
    job: toJobView(updatedJob),
  };
}
