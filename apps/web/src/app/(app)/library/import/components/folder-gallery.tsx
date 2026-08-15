'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, CircleAlert, ImageOff } from 'lucide-react';
import { Badge, Button, ErrorNote } from '@/components/ui';
import { continueImportBatch, startImportJob } from '../actions';

export interface FolderImageProps {
  id: string;
  name: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
}

export type FileStatus = 'pending' | 'imported' | 'failed';

export interface FileStatusProps {
  status: FileStatus;
  attempts: number;
  error: string | null;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

/**
 * Browse-and-select for one Drive folder, then import.
 *
 * `statuses` is a prop, not copied into local state: it is the server's word
 * on what has actually happened to each file, and `router.refresh()` after
 * every batch is what keeps it current — refreshing re-renders the Server
 * Component parent with fresh data while this component stays mounted and
 * its in-flight import loop keeps running regardless. Only `selected` (the
 * user's checkbox intent) is genuinely local state.
 */
export function FolderGallery({
  folderId,
  folderName,
  images,
  statuses,
  initialJobId,
}: {
  folderId: string;
  folderName: string;
  images: FolderImageProps[];
  statuses: Record<string, FileStatusProps>;
  initialJobId: string | null;
}) {
  const router = useRouter();

  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(
        Object.entries(statuses)
          .filter(([, value]) => value.status !== 'imported')
          .map(([id]) => id),
      ),
  );
  const [jobId, setJobId] = useState<string | null>(initialJobId);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brokenThumbs, setBrokenThumbs] = useState<Set<string>>(new Set());
  const stopRequested = useRef(false);

  const counts = useMemo(() => {
    const values = Object.values(statuses);
    return {
      total: values.length,
      imported: values.filter((v) => v.status === 'imported').length,
      failed: values.filter((v) => v.status === 'failed').length,
      pending: values.filter((v) => v.status === 'pending').length,
    };
  }, [statuses]);

  const selectableCount = images.filter((image) => statuses[image.id]?.status !== 'imported').length;

  function toggle(id: string) {
    if (statuses[id]?.status === 'imported') return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(
      new Set(images.filter((image) => statuses[image.id]?.status !== 'imported').map((i) => i.id)),
    );
  }

  function selectNone() {
    setSelected(new Set());
  }

  async function runLoop(id: string) {
    stopRequested.current = false;
    setRunning(true);
    setError(null);

    try {
      // Guards against a stuck loop: `continueImportBatch` should always make
      // forward progress or report `done`, but a defensive cap means a bug
      // there cannot hang the browser tab importing forever.
      for (let iteration = 0; iteration < 500; iteration++) {
        if (stopRequested.current) break;

        const result = await continueImportBatch(id);
        router.refresh();

        if (!result.ok) {
          setError(result.error);
          break;
        }
        if (result.done) break;
      }
    } finally {
      setRunning(false);
    }
  }

  async function handleImportClick() {
    setError(null);
    const fileIds = [...selected];
    if (fileIds.length === 0) return;

    const result = await startImportJob({ folderId, folderName, fileIds });
    if (!result.ok || !result.jobId) {
      setError(result.error ?? 'Could not start the import.');
      return;
    }

    setJobId(result.jobId);
    router.refresh();
    await runLoop(result.jobId);
  }

  function handleStop() {
    stopRequested.current = true;
  }

  const buttonLabel = running
    ? 'Importing…'
    : jobId && counts.pending + counts.failed > 0 && counts.imported > 0
      ? `Resume import (${selected.size} selected)`
      : `Import ${selected.size} selected`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-subtle bg-surface-raised p-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          <span>
            {selected.size} of {selectableCount} selectable photos chosen
          </span>
          {counts.total > 0 ? (
            <span aria-live="polite">
              {counts.imported} imported
              {counts.failed > 0 ? `, ${counts.failed} failed` : ''}
              {counts.pending > 0 ? `, ${counts.pending} pending` : ''} of {counts.total} tracked
            </span>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={selectAll} disabled={running}>
            Select all
          </Button>
          <Button type="button" size="sm" onClick={selectNone} disabled={running}>
            Select none
          </Button>
        </div>
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="primary"
          onClick={handleImportClick}
          disabled={running || selected.size === 0}
        >
          {buttonLabel}
        </Button>
        {running ? (
          <Button type="button" onClick={handleStop}>
            Pause
          </Button>
        ) : null}
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {images.map((image) => {
          const fileStatus = statuses[image.id];
          const isImported = fileStatus?.status === 'imported';
          const isFailed = fileStatus?.status === 'failed';
          const isSelected = selected.has(image.id);
          const thumbBroken = brokenThumbs.has(image.id);

          return (
            <li key={image.id}>
              <label
                className={`relative block cursor-pointer overflow-hidden rounded-md border ${
                  isImported ? 'cursor-default border-success/40' : 'border-subtle'
                } ${isSelected && !isImported ? 'ring-2 ring-accent' : ''}`}
              >
                <input
                  type="checkbox"
                  className="absolute top-2 left-2 z-10 size-4 accent-accent"
                  checked={isImported || isSelected}
                  disabled={isImported}
                  onChange={() => toggle(image.id)}
                  aria-label={`Select ${image.name}`}
                />

                <div className="flex aspect-square items-center justify-center bg-surface-raised">
                  {thumbBroken ? (
                    <ImageOff size={22} className="text-faint" aria-hidden="true" />
                  ) : (
                    // Proxied through our own server, never a direct Drive URL:
                    // the thumbnail bytes are fetched with the service
                    // account's credentials, which must never reach the
                    // browser. See thumb/[fileId]/route.ts.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/library/import/thumb/${encodeURIComponent(image.id)}`}
                      alt={image.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                      onError={() => setBrokenThumbs((current) => new Set(current).add(image.id))}
                    />
                  )}
                </div>

                {isImported ? (
                  <span className="absolute top-2 right-2 rounded-full bg-surface p-0.5 text-success">
                    <CheckCircle2 size={16} aria-hidden="true" />
                  </span>
                ) : isFailed ? (
                  <span className="absolute top-2 right-2 rounded-full bg-surface p-0.5 text-danger">
                    <CircleAlert size={16} aria-hidden="true" />
                  </span>
                ) : null}

                <div className="space-y-0.5 p-2">
                  <p className="truncate text-xs font-medium text-foreground" title={image.name}>
                    {image.name}
                  </p>
                  <p className="text-[11px] text-faint">
                    {formatBytes(image.byteSize)}
                    {image.width && image.height ? ` · ${image.width}×${image.height}` : ''}
                  </p>
                  {isFailed && fileStatus?.error ? (
                    <p className="truncate text-[11px] text-danger" title={fileStatus.error}>
                      {fileStatus.error}
                    </p>
                  ) : null}
                </div>

                {isImported ? (
                  <Badge tone="success" className="absolute bottom-2 left-2">
                    Imported
                  </Badge>
                ) : null}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
