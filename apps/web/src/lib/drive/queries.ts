/**
 * Read helpers for the Drive import module.
 *
 * `listSharedFolders` / `listFolderImages` go through `getDriveSource()` —
 * never `fetch()` the Drive API directly, see `@lensello/core/integrations`.
 * In live mode with no service account configured, that throws
 * `NotImplementedError`; callers render that as setup instructions, not a
 * crash (see `page.tsx`, which catches it the same way `/connections` catches
 * an unconfigured `getIntegrations()`).
 *
 * Everything else here reads through the caller's Supabase client, under
 * their RLS context — nothing uses the service-role key.
 */

import { driveStatus, getDriveSource } from '@lensello/core/integrations';
import type { Session } from '@/lib/auth';
import type { Tables } from '@/lib/db.types';
import { isUuid } from './constants';

export { driveStatus };

type Db = Session['supabase'];

export interface FolderView {
  id: string;
  name: string;
}

export interface FolderImageView {
  id: string;
  name: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  modifiedTime: string;
}

/** Folders shared with the service account. Never the whole Drive. */
export async function listSharedFolders(): Promise<FolderView[]> {
  const folders = await getDriveSource().listFolders();
  return [...folders]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((folder) => ({ id: folder.id, name: folder.name }));
}

/** One folder's name, or null if it is no longer shared / never was. */
export async function findSharedFolder(folderId: string): Promise<FolderView | null> {
  const folders = await listSharedFolders();
  return folders.find((folder) => folder.id === folderId) ?? null;
}

/** Image files directly inside one folder. Not recursive into subfolders. */
export async function listFolderImages(folderId: string): Promise<FolderImageView[]> {
  const images = await getDriveSource().listImages(folderId);
  return [...images]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((image) => ({ ...image }));
}

export interface JobView {
  id: string;
  driveFolderId: string;
  driveFolderName: string;
  shootId: string;
  status: Tables<'drive_import_jobs'>['status'];
  totalFiles: number;
  importedFiles: number;
  failedFiles: number;
  createdAt: string;
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

/** The import job for one Drive folder, if browsing or importing it has started before. */
export async function getJobForFolder(supabase: Db, driveFolderId: string): Promise<JobView | null> {
  const { data, error } = await supabase
    .from('drive_import_jobs')
    .select('*')
    .eq('drive_folder_id', driveFolderId)
    .maybeSingle();

  if (error) throw new Error(`Could not load the import job: ${error.message}`);
  return data ? toJobView(data) : null;
}

export async function getJob(supabase: Db, jobId: string): Promise<JobView | null> {
  if (!isUuid(jobId)) return null;

  const { data, error } = await supabase
    .from('drive_import_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle();

  if (error) throw new Error(`Could not load the import job: ${error.message}`);
  return data ? toJobView(data) : null;
}

/** Every import job, newest first — the index page's "past imports" list. */
export async function listRecentJobs(supabase: Db, limit = 20): Promise<JobView[]> {
  const { data, error } = await supabase
    .from('drive_import_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Could not load import jobs: ${error.message}`);
  return (data ?? []).map(toJobView);
}

export interface FileStatusView {
  driveFileId: string;
  status: Tables<'drive_import_files'>['status'];
  attempts: number;
  error: string | null;
  assetId: string | null;
}

/** Per-file status for one job, keyed by Drive file id for a cheap lookup in the browse grid. */
export async function listJobFileStatuses(
  supabase: Db,
  jobId: string,
): Promise<Map<string, FileStatusView>> {
  const map = new Map<string, FileStatusView>();
  if (!isUuid(jobId)) return map;

  const { data, error } = await supabase
    .from('drive_import_files')
    .select('drive_file_id, status, attempts, error, asset_id')
    .eq('job_id', jobId);

  if (error) throw new Error(`Could not load import file status: ${error.message}`);

  for (const row of data ?? []) {
    map.set(row.drive_file_id, {
      driveFileId: row.drive_file_id,
      status: row.status,
      attempts: row.attempts,
      error: row.error,
      assetId: row.asset_id,
    });
  }

  return map;
}
