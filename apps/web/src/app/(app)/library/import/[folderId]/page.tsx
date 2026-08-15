import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ImageOff } from 'lucide-react';
import { EmptyState, ErrorNote, PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { isPlausibleDriveId } from '@/lib/drive/constants';
import {
  findSharedFolder,
  getJobForFolder,
  listFolderImages,
  listJobFileStatuses,
} from '@/lib/drive/queries';
import { FolderGallery, type FileStatusProps } from '../components/folder-gallery';

export const metadata: Metadata = { title: 'Import from Drive' };

export default async function ImportFolderPage(
  props: PageProps<'/library/import/[folderId]'>,
) {
  const { folderId: rawFolderId } = await props.params;
  const { supabase } = await requireUserOrRedirect();

  const folderId = decodeURIComponent(rawFolderId);

  if (!isPlausibleDriveId(folderId)) {
    return (
      <>
        <BackLink />
        <PageHeader title="Import from Drive" />
        <ErrorNote>That is not a valid Drive folder.</ErrorNote>
      </>
    );
  }

  const existingJob = await getJobForFolder(supabase, folderId);

  let images: Awaited<ReturnType<typeof listFolderImages>> = [];
  let folderMeta: Awaited<ReturnType<typeof findSharedFolder>> = null;
  let loadError: string | null = null;
  try {
    [images, folderMeta] = await Promise.all([
      listFolderImages(folderId),
      findSharedFolder(folderId),
    ]);
  } catch (cause) {
    loadError = cause instanceof Error ? cause.message : 'Could not load this folder.';
  }

  const folderName =
    folderMeta?.name ?? existingJob?.driveFolderName ?? `Drive folder (${folderId})`;

  // `listJobFileStatuses` returns an empty map for an invalid id, so this
  // reads fine even when there is no job yet (`existingJob?.id` is undefined).
  const statusMap = await listJobFileStatuses(supabase, existingJob?.id ?? '');
  const statuses: Record<string, FileStatusProps> = {};
  for (const [driveFileId, status] of statusMap) {
    statuses[driveFileId] = {
      status: status.status,
      attempts: status.attempts,
      error: status.error,
    };
  }

  return (
    <>
      <BackLink />

      <PageHeader
        title={folderName}
        description="Select the photos you want and import them. Nothing is imported until you choose it — this never sweeps the whole folder automatically."
      />

      {loadError ? <ErrorNote>{loadError}</ErrorNote> : null}

      {!loadError && images.length === 0 ? (
        <EmptyState
          icon={<ImageOff size={24} aria-hidden="true" />}
          title="No images in this folder"
          description="Only image files directly inside the folder are shown — not subfolders, and not documents, video, or other file types."
        />
      ) : !loadError ? (
        <FolderGallery
          folderId={folderId}
          folderName={folderName}
          images={images}
          statuses={statuses}
          initialJobId={existingJob?.id ?? null}
        />
      ) : null}
    </>
  );
}

function BackLink() {
  return (
    <Link
      href="/library/import"
      className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
    >
      <ChevronLeft size={15} aria-hidden="true" />
      Import from Drive
    </Link>
  );
}
