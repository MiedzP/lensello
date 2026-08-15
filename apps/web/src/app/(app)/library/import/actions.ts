'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { isPlausibleDriveId, isUuid, MAX_FILES_PER_SELECTION } from '@/lib/drive/constants';
import { addFilesToJob, ensureImportJob, runImportBatch } from '@/lib/drive/import-run';

/**
 * Every mutation the import module needs. Each opens with `requireUser()` —
 * a Server Action is a public POST endpoint regardless of what the UI
 * renders, see AGENTS.md — and every statement runs through that user's
 * Supabase client, so RLS (not this file) is the real enforcement boundary.
 * The service-role key is never used here.
 */

export interface ActionResult {
  ok: boolean;
  error: string | null;
}

function fail(error: string): ActionResult {
  return { ok: false, error };
}

function folderName(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().slice(0, 200) : '';
}

function fileIdList(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const unique = [...new Set(raw.filter(isPlausibleDriveId))];
  if (unique.length === 0 || unique.length > MAX_FILES_PER_SELECTION) return null;
  return unique;
}

export interface StartImportResult extends ActionResult {
  jobId: string | null;
  shootId: string | null;
  added: number;
}

/**
 * Starts (or resumes tracking into) the import job for one Drive folder.
 *
 * Reusing the folder's existing job — rather than creating a new one every
 * time this is called — is what makes selecting from the same folder twice
 * additive instead of duplicative: a file already tracked is skipped by
 * `addFilesToJob`, and a file newly added here still only ever gets one row.
 * This does not download anything; call `continueImportBatch` afterwards
 * (repeatedly, until it reports `done`) to actually import the files.
 */
export async function startImportJob(input: {
  folderId: string;
  folderName: string;
  fileIds: string[];
}): Promise<StartImportResult> {
  const { user, supabase } = await requireUser();

  const driveFolderId = input?.folderId;
  const driveFolderName = folderName(input?.folderName);
  const fileIds = fileIdList(input?.fileIds);

  if (!isPlausibleDriveId(driveFolderId)) {
    return { ...fail('That folder is not valid.'), jobId: null, shootId: null, added: 0 };
  }
  if (driveFolderName.length === 0) {
    return { ...fail('That folder has no name.'), jobId: null, shootId: null, added: 0 };
  }
  if (!fileIds) {
    return {
      ...fail(`Choose between 1 and ${MAX_FILES_PER_SELECTION} photos.`),
      jobId: null,
      shootId: null,
      added: 0,
    };
  }

  try {
    const { job } = await ensureImportJob(supabase, {
      driveFolderId,
      driveFolderName,
      createdBy: user.id,
    });
    const { added, job: updated } = await addFilesToJob(supabase, {
      jobId: job.id,
      driveFolderId,
      fileIds,
    });

    revalidatePath('/library');
    revalidatePath('/library/import');
    revalidatePath(`/library/import/${encodeURIComponent(driveFolderId)}`);

    return { ok: true, error: null, jobId: updated.id, shootId: updated.shootId, added };
  } catch (cause) {
    return {
      ...fail(cause instanceof Error ? cause.message : 'Could not start the import.'),
      jobId: null,
      shootId: null,
      added: 0,
    };
  }
}

export interface ContinueImportResult extends ActionResult {
  processed: number;
  imported: number;
  failed: number;
  pending: number;
  done: boolean;
}

/**
 * Attempts one batch of outstanding files for a job and reports progress.
 *
 * The caller (`ImportPanel`) drives this in a loop — call it, look at `done`,
 * call it again if not — which is the whole resumability story: each call is
 * a short, self-contained unit of work, so a closed tab or a serverless
 * timeout mid-import just means the next call picks up where the last one
 * left off, never redoing a file that already succeeded.
 */
export async function continueImportBatch(jobId: string): Promise<ContinueImportResult> {
  const { supabase } = await requireUser();

  if (!isUuid(jobId)) {
    return { ...fail('That import job is not valid.'), processed: 0, imported: 0, failed: 0, pending: 0, done: true };
  }

  try {
    const result = await runImportBatch(supabase, { jobId });

    revalidatePath('/library');
    revalidatePath(`/library/${result.job.shootId}`);
    revalidatePath('/library/import');

    return {
      ok: true,
      error: null,
      processed: result.processed,
      imported: result.imported,
      failed: result.failed,
      pending: result.job.totalFiles - result.job.importedFiles - result.job.failedFiles,
      done: result.done,
    };
  } catch (cause) {
    return {
      ...fail(cause instanceof Error ? cause.message : 'The import batch failed.'),
      processed: 0,
      imported: 0,
      failed: 0,
      pending: 0,
      done: true,
    };
  }
}
