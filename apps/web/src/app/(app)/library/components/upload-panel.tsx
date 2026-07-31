'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, CircleAlert, Upload, X } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorNote,
  Field,
} from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  PHOTOS_BUCKET,
  UPLOAD_ACCEPT,
  buildStoragePath,
  formatBytes,
  isAllowedMimeType,
} from '@/lib/library/constants';
import { recordUploadedAssets, type UploadedAsset } from '../actions';

type Status = 'queued' | 'uploading' | 'saving' | 'done' | 'error';

interface QueueItem {
  key: string;
  filename: string;
  byteSize: number;
  status: Status;
  /** 0–100. Real byte progress while uploading. */
  progress: number;
  error: string | null;
}

/**
 * Multi-file upload straight from the browser to Supabase Storage.
 *
 * The bytes never pass through the Next server: a Server Action would have to
 * buffer a 100 MB photo in the server process for no benefit. Instead the
 * browser client mints a one-object signed upload URL and PUTs to it, then a
 * Server Action records the rows.
 *
 * The PUT goes through XMLHttpRequest rather than `uploadToSignedUrl` for one
 * reason: XHR reports upload progress and supports cancellation, and `fetch`
 * does not. The request body is the same multipart shape the SDK builds.
 */
export function UploadPanel({ shootId }: { shootId: string }) {
  const inputId = useId();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef(new Map<string, XMLHttpRequest>());

  const [items, setItems] = useState<QueueItem[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  const patch = useCallback((key: string, changes: Partial<QueueItem>) => {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...changes } : item)),
    );
  }, []);

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      setBatchError(null);
      setIsBusy(true);

      const queued: QueueItem[] = files.map((file, index) => ({
        key: `${Date.now()}-${index}-${file.name}`,
        filename: file.name,
        byteSize: file.size,
        status: 'queued',
        progress: 0,
        error: null,
      }));

      setItems((current) => [...current, ...queued]);

      const supabase = createClient();
      const recorded: UploadedAsset[] = [];

      // Sequential: a photographer dropping 60 full-resolution frames on a
      // domestic uplink gets more useful feedback (and fewer timeouts) from one
      // upload at a time than from 60 competing for bandwidth.
      for (const [index, file] of files.entries()) {
        const item = queued[index];

        // Validate before spending any bandwidth — the bucket enforces both of
        // these server-side, but failing here is instant and explains itself.
        if (!isAllowedMimeType(file.type)) {
          patch(item.key, {
            status: 'error',
            error: `${file.type || 'Unknown type'} is not an accepted image format.`,
          });
          continue;
        }
        if (file.size > MAX_UPLOAD_BYTES) {
          patch(item.key, {
            status: 'error',
            error: `${formatBytes(file.size)} is over the ${formatBytes(MAX_UPLOAD_BYTES)} limit.`,
          });
          continue;
        }
        if (file.size === 0) {
          patch(item.key, { status: 'error', error: 'This file is empty.' });
          continue;
        }

        patch(item.key, { status: 'uploading', progress: 0 });

        const storagePath = buildStoragePath(shootId, file.name);

        const signed = await supabase.storage
          .from(PHOTOS_BUCKET)
          .createSignedUploadUrl(storagePath);

        if (signed.error || !signed.data) {
          patch(item.key, {
            status: 'error',
            error: signed.error?.message ?? 'Could not start the upload.',
          });
          continue;
        }

        try {
          await putWithProgress({
            url: signed.data.signedUrl,
            file,
            onProgress: (progress) => patch(item.key, { progress }),
            register: (xhr) => inFlight.current.set(item.key, xhr),
          });
        } catch (cause) {
          patch(item.key, {
            status: 'error',
            error: cause instanceof Error ? cause.message : 'The upload failed.',
          });
          continue;
        } finally {
          inFlight.current.delete(item.key);
        }

        patch(item.key, { status: 'saving', progress: 100 });

        recorded.push({
          storagePath,
          filename: file.name,
          mimeType: file.type,
          byteSize: file.size,
          ...(await readDimensions(file)),
        });
      }

      if (recorded.length > 0) {
        const result = await recordUploadedAssets(shootId, recorded);

        setItems((current) =>
          current.map((item) =>
            item.status === 'saving'
              ? result.ok
                ? { ...item, status: 'done' }
                : { ...item, status: 'error', error: 'Saved file, but not its record.' }
              : item,
          ),
        );

        if (!result.ok) setBatchError(result.error);

        // The action revalidates this path; refresh pulls the new Server
        // Component tree so the grid below shows the photos that just landed.
        router.refresh();
      }

      setIsBusy(false);
      // Clearing the input lets the same file be picked again after a failure.
      if (inputRef.current) inputRef.current.value = '';
    },
    [patch, router, shootId],
  );

  function cancelAll() {
    for (const xhr of inFlight.current.values()) xhr.abort();
    inFlight.current.clear();
  }

  const done = items.filter((item) => item.status === 'done').length;
  const failed = items.filter((item) => item.status === 'error').length;

  return (
    <Card className="mb-6">
      <CardHeader
        title="Add photos"
        description={`JPEG, PNG, WebP, AVIF or TIFF, up to ${formatBytes(MAX_UPLOAD_BYTES)} each.`}
        action={
          items.length > 0 && !isBusy ? (
            <Button variant="ghost" size="sm" onClick={() => setItems([])}>
              Clear list
            </Button>
          ) : isBusy ? (
            <Button variant="ghost" size="sm" onClick={cancelAll}>
              Cancel
            </Button>
          ) : null
        }
      />
      <CardBody className="space-y-4">
        <Field
          label="Choose photos"
          htmlFor={inputId}
          hint={`Accepted types: ${ALLOWED_MIME_TYPES.map((type) => type.replace('image/', '')).join(', ')}.`}
        >
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            multiple
            accept={UPLOAD_ACCEPT}
            disabled={isBusy}
            onChange={(event) => void handleFiles([...(event.target.files ?? [])])}
            className={cn(
              'block w-full cursor-pointer rounded-md border border-strong bg-surface text-sm text-foreground',
              'file:mr-3 file:cursor-pointer file:border-0 file:bg-surface-raised file:px-3 file:py-2',
              'file:text-sm file:font-medium file:text-foreground',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          />
        </Field>

        {batchError ? <ErrorNote>{batchError}</ErrorNote> : null}

        {items.length > 0 ? (
          <>
            <p className="text-xs text-muted" aria-live="polite">
              {done} uploaded
              {failed > 0 ? `, ${failed} failed` : ''} of {items.length}
            </p>

            <ul className="divide-y divide-subtle rounded-md border border-subtle">
              {items.map((item) => (
                <li key={item.key} className="flex items-center gap-3 px-3 py-2">
                  <span className="shrink-0">
                    {item.status === 'done' ? (
                      <CheckCircle2 size={15} className="text-success" aria-hidden="true" />
                    ) : item.status === 'error' ? (
                      <CircleAlert size={15} className="text-danger" aria-hidden="true" />
                    ) : (
                      <Upload size={15} className="text-muted" aria-hidden="true" />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-foreground">
                      {item.filename}
                    </span>
                    {item.error ? (
                      <span className="block text-xs text-danger">{item.error}</span>
                    ) : (
                      <span
                        role="progressbar"
                        aria-label={`Upload progress for ${item.filename}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={item.status === 'queued' ? 0 : item.progress}
                        className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-surface-raised"
                      >
                        <span
                          className={cn(
                            'block h-full rounded-full transition-[width]',
                            item.status === 'done' ? 'bg-success' : 'bg-accent',
                          )}
                          style={{ width: `${item.status === 'queued' ? 0 : item.progress}%` }}
                        />
                      </span>
                    )}
                  </span>

                  <span className="shrink-0 text-xs tabular-nums text-faint">
                    {item.status === 'error'
                      ? 'Failed'
                      : item.status === 'done'
                        ? formatBytes(item.byteSize)
                        : item.status === 'saving'
                          ? 'Saving…'
                          : `${item.progress}%`}
                  </span>

                  {item.status === 'error' || item.status === 'done' ? (
                    <button
                      type="button"
                      aria-label={`Dismiss ${item.filename}`}
                      onClick={() =>
                        setItems((current) => current.filter((row) => row.key !== item.key))
                      }
                      className="shrink-0 rounded p-1 text-faint hover:bg-surface-hover hover:text-foreground"
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </CardBody>
    </Card>
  );
}

/**
 * PUTs one file to a Supabase signed upload URL, reporting byte progress.
 *
 * The multipart body mirrors what `StorageFileApi.uploadToSignedUrl` sends for a
 * Blob, so Storage derives the object's content type from the file part.
 */
function putWithProgress({
  url,
  file,
  onProgress,
  register,
}: {
  url: string;
  file: File;
  onProgress: (percent: number) => void;
  register: (xhr: XMLHttpRequest) => void;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append('cacheControl', '3600');
    body.append('', file);

    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    // The signed URL carries its own token; the anon key is only here because
    // the API gateway expects it on every request. It is a public value.
    xhr.setRequestHeader('apikey', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '');
    xhr.setRequestHeader('x-upsert', 'false');

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      reject(new Error(describeStorageError(xhr.status, xhr.responseText)));
    });

    xhr.addEventListener('error', () => reject(new Error('The network dropped mid-upload.')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled.')));

    register(xhr);
    xhr.send(body);
  });
}

function describeStorageError(status: number, responseText: string): string {
  try {
    const parsed = JSON.parse(responseText) as { message?: string; error?: string };
    if (parsed.message) return parsed.message;
    if (parsed.error) return parsed.error;
  } catch {
    // Non-JSON error body; fall through to the status code.
  }
  return `Storage rejected the upload (HTTP ${status}).`;
}

/**
 * Reads pixel dimensions in the browser.
 *
 * Best-effort by design: browsers cannot decode TIFF, and a corrupt file should
 * not block the upload. Unknown dimensions stay null, which the column allows.
 */
async function readDimensions(
  file: File,
): Promise<{ width: number | null; height: number | null }> {
  const url = URL.createObjectURL(file);

  try {
    const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error('undecodable'));
      image.src = url;
    });

    return size.width > 0 && size.height > 0 ? size : { width: null, height: null };
  } catch {
    return { width: null, height: null };
  } finally {
    URL.revokeObjectURL(url);
  }
}
