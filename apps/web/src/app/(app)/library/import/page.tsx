import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, Folder, Images } from 'lucide-react';
import { Badge, Card, CardBody, EmptyState, ErrorNote, PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import {
  driveStatus,
  listRecentJobs,
  listSharedFolders,
  type FolderView,
  type JobView,
} from '@/lib/drive/queries';
import { DriveStatusCard } from './components/drive-status-card';

export const metadata: Metadata = { title: 'Import from Drive' };

const JOB_STATUS_LABEL: Record<JobView['status'], string> = {
  pending: 'Selected, not started',
  running: 'Importing…',
  completed: 'Fully imported',
  completed_with_errors: 'Imported, with some failures',
};

const JOB_STATUS_TONE: Record<JobView['status'], 'neutral' | 'accent' | 'success' | 'warning'> = {
  pending: 'neutral',
  running: 'accent',
  completed: 'success',
  completed_with_errors: 'warning',
};

/**
 * Folder picker for Drive import.
 *
 * Folders come straight from `getDriveSource().listFolders()` — never the
 * whole Drive, only whatever has actually been shared with the service
 * account, which is the entire point of the sharing model (see
 * `DriveStatusCard`). In live mode with nothing configured yet, that throws
 * `NotImplementedError`; caught here the same way `/connections` catches an
 * unconfigured `getIntegrations()`, so the page explains the gap instead of
 * 500ing.
 */
export default async function ImportPage() {
  const { supabase } = await requireUserOrRedirect();

  const status = driveStatus();

  let folders: FolderView[] = [];
  let loadError: string | null = null;
  try {
    folders = await listSharedFolders();
  } catch (cause) {
    loadError = cause instanceof Error ? cause.message : 'Could not load Drive folders.';
  }

  const jobs = await listRecentJobs(supabase);
  const jobByFolder = new Map(jobs.map((job) => [job.driveFolderId, job]));

  return (
    <>
      <Link
        href="/library"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ChevronLeft size={15} aria-hidden="true" />
        Library
      </Link>

      <PageHeader
        title="Import from Drive"
        description="Pull in-house work and personal photography out of Google Drive — the studio's own speeches reel, a family album — so it is reachable for campaigns without re-uploading it by hand. Imported photos land under their own shoot and are never attached to a client's gallery."
      />

      {status === 'mock' ? (
        <Card className="mb-6 border-warning/30 bg-warning-subtle">
          <CardBody className="text-sm text-warning">
            Running against the built-in simulator. The folders below are
            fixtures — importing from them is safe to try, but nothing is
            reading your studio&rsquo;s actual Drive yet. See the connection
            status below.
          </CardBody>
        </Card>
      ) : null}

      {loadError ? <ErrorNote>{loadError}</ErrorNote> : null}

      {status !== 'live' || loadError ? null : (
        <p className="mb-3 text-xs text-muted">
          Service account connected. Sharing a new folder in Google Drive adds
          it to the list below the next time this page loads.
        </p>
      )}

      {!loadError && folders.length === 0 ? (
        <EmptyState
          icon={<Folder size={24} aria-hidden="true" />}
          title="No folders shared yet"
          description="Share a Drive folder with the service account, then reload this page. See the setup steps below."
        />
      ) : !loadError ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {folders.map((folder) => {
            const job = jobByFolder.get(folder.id);
            return (
              <li key={folder.id}>
                <Link
                  href={`/library/import/${encodeURIComponent(folder.id)}`}
                  className="block rounded-lg border border-subtle bg-surface p-4 transition-colors hover:bg-surface-hover"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-2.5">
                      <Folder size={16} className="mt-0.5 shrink-0 text-faint" aria-hidden="true" />
                      <span className="min-w-0 truncate text-sm font-medium text-foreground">
                        {folder.name}
                      </span>
                    </div>
                    {job ? (
                      <Badge tone={JOB_STATUS_TONE[job.status]}>{JOB_STATUS_LABEL[job.status]}</Badge>
                    ) : null}
                  </div>
                  {job ? (
                    <p className="mt-2 text-xs text-muted">
                      {job.importedFiles} of {job.totalFiles} imported
                      {job.failedFiles > 0 ? `, ${job.failedFiles} failed` : ''}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-muted">Not imported yet</p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="mt-8">
        <DriveStatusCard
          status={status}
          serviceAccount={
            status === 'live' ? (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() ?? null) : null
          }
        />
      </div>

      {jobs.length > 0 ? (
        <section className="mt-8 space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Images size={16} aria-hidden="true" />
            Past imports
          </h2>
          <ul className="divide-y divide-subtle rounded-md border border-subtle">
            {jobs.map((job) => (
              <li key={job.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {job.driveFolderName}
                  </p>
                  <p className="text-xs text-muted">
                    {job.importedFiles} of {job.totalFiles} imported
                    {job.failedFiles > 0 ? `, ${job.failedFiles} failed` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge tone={JOB_STATUS_TONE[job.status]}>{JOB_STATUS_LABEL[job.status]}</Badge>
                  <Link
                    href={`/library/import/${encodeURIComponent(job.driveFolderId)}`}
                    className="text-xs text-accent hover:underline"
                  >
                    {job.status === 'running' || job.status === 'pending' ? 'Resume' : 'Open'}
                  </Link>
                  <Link href={`/library/${job.shootId}`} className="text-xs text-accent hover:underline">
                    View shoot
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
