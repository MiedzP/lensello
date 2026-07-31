'use client';

import Image from 'next/image';
import { useState, useTransition } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { SHOOT_TYPE_LABELS } from '@lensello/core';
import type { LibraryShoot, Photo } from '@/lib/campaigns/queries';
import { fetchLibraryPhotos } from '../actions';

/**
 * Picks photos out of the library for one post.
 *
 * The library is fetched on first open rather than embedded in the page: signing
 * URLs for every candidate photo on every campaign render — once per post card —
 * would be a large payload nobody asked for.
 */
export function PhotoPicker({
  attachedIds,
  remaining,
  onPick,
}: {
  attachedIds: readonly string[];
  /** How many more photos this post can take. */
  remaining: number;
  onPick: (photo: Photo) => void;
}) {
  const [open, setOpen] = useState(false);
  const [shoots, setShoots] = useState<LibraryShoot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && shoots === null) {
      startLoading(async () => {
        const result = await fetchLibraryPhotos();
        setShoots(result.shoots);
        setError(result.error);
      });
    }
  }

  const attached = new Set(attachedIds);

  return (
    <div>
      <Button size="sm" onClick={toggle} aria-expanded={open}>
        {open ? (
          <>
            <X size={14} aria-hidden="true" />
            Close library
          </>
        ) : (
          <>
            <ImagePlus size={14} aria-hidden="true" />
            Attach photos
          </>
        )}
      </Button>

      {open ? (
        <div className="mt-3 rounded-md border border-subtle bg-surface-raised p-3">
          {remaining <= 0 ? (
            <p className="text-sm text-muted">
              This post is at the carousel limit. Remove a photo to swap one in.
            </p>
          ) : (
            <p className="text-xs text-muted">
              Newest shoots first, selects and highest-rated frames first within
              each. Room for {remaining} more.
            </p>
          )}

          {loading ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              Loading the library…
            </p>
          ) : null}

          {error ? (
            <p role="alert" className="mt-3 text-sm text-danger">
              {error}
            </p>
          ) : null}

          {!loading && shoots !== null && shoots.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              The library has no photos yet. Upload a shoot in Library and it will
              show up here.
            </p>
          ) : null}

          {shoots?.map((shoot) => (
            <section key={shoot.shootId} className="mt-4">
              <h4 className="text-xs font-semibold text-foreground">
                {shoot.title}
                <span className="ml-2 font-normal text-faint">
                  {SHOOT_TYPE_LABELS[shoot.type] ?? shoot.type}
                </span>
              </h4>
              <ul className="mt-2 flex flex-wrap gap-2">
                {shoot.photos.map((photo) => {
                  const isAttached = attached.has(photo.assetId);
                  const disabled = isAttached || remaining <= 0;

                  return (
                    <li key={photo.assetId}>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onPick(photo)}
                        title={photo.altText ?? photo.filename}
                        className="group relative block size-20 overflow-hidden rounded-md border border-subtle disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {photo.url ? (
                          <Image
                            src={photo.url}
                            alt={photo.altText ?? photo.filename}
                            width={160}
                            height={160}
                            quality={50}
                            className="size-full object-cover"
                          />
                        ) : (
                          <span className="flex size-full items-center justify-center bg-surface px-1 text-center text-[10px] text-faint">
                            Preview unavailable
                          </span>
                        )}
                        {isAttached ? (
                          <span className="absolute inset-x-0 bottom-0 bg-surface/90 py-0.5 text-[10px] font-medium text-foreground">
                            Attached
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
