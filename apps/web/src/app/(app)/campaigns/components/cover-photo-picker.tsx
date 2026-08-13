'use client';

import Image from 'next/image';
import { useState, useTransition } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { SHOOT_TYPE_LABELS } from '@lensello/core';
import type { LibraryShoot } from '@/lib/campaigns/queries';
import { fetchLibraryPhotos, setCampaignCover } from '../actions';

/**
 * "Photographers are visual people" — a cover photo, drawn from the same
 * library the posts pull from, is what makes a campaign recognisable on the
 * list and on the calendar rather than reading as a row of admin text.
 */
export function CoverPhotoPicker({
  campaignId,
  coverUrl,
}: {
  campaignId: string;
  coverUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [shoots, setShoots] = useState<LibraryShoot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();

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

  function pick(assetId: string) {
    startSaving(async () => {
      const formData = new FormData();
      formData.set('campaignId', campaignId);
      formData.set('assetId', assetId);
      const result = await setCampaignCover({ error: null, message: null }, formData);
      if (result.error) setError(result.error);
      else setOpen(false);
    });
  }

  function clear() {
    startSaving(async () => {
      const formData = new FormData();
      formData.set('campaignId', campaignId);
      formData.set('assetId', '');
      await setCampaignCover({ error: null, message: null }, formData);
    });
  }

  return (
    <div className="flex items-start gap-3">
      <div className="relative size-16 shrink-0 overflow-hidden rounded-md border border-subtle bg-surface-raised">
        {coverUrl ? (
          <Image src={coverUrl} alt="" fill sizes="64px" className="object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-faint">
            <ImagePlus size={18} aria-hidden="true" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={toggle} disabled={saving} aria-expanded={open}>
            {open ? (
              <>
                <X size={14} aria-hidden="true" />
                Close library
              </>
            ) : (
              <>
                <ImagePlus size={14} aria-hidden="true" />
                {coverUrl ? 'Change cover photo' : 'Set a cover photo'}
              </>
            )}
          </Button>
          {coverUrl ? (
            <Button size="sm" onClick={clear} disabled={saving}>
              Remove
            </Button>
          ) : null}
        </div>

        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}

        {open ? (
          <div className="mt-3 max-h-72 overflow-y-auto rounded-md border border-subtle bg-surface-raised p-3">
            {loading ? (
              <p className="flex items-center gap-2 text-sm text-muted">
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                Loading the library…
              </p>
            ) : null}

            {!loading && shoots !== null && shoots.length === 0 ? (
              <p className="text-sm text-muted">
                The library has no photos yet. Upload a shoot in Library and it
                will show up here.
              </p>
            ) : null}

            {shoots?.map((shoot) => (
              <section key={shoot.shootId} className="mt-3 first:mt-0">
                <h4 className="text-xs font-semibold text-foreground">
                  {shoot.title}
                  <span className="ml-2 font-normal text-faint">
                    {SHOOT_TYPE_LABELS[shoot.type] ?? shoot.type}
                  </span>
                </h4>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {shoot.photos.map((photo) => (
                    <li key={photo.assetId}>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => pick(photo.assetId)}
                        title={photo.altText ?? photo.filename}
                        className="group relative block size-16 overflow-hidden rounded-md border border-subtle disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {photo.url ? (
                          <Image
                            src={photo.url}
                            alt={photo.altText ?? photo.filename}
                            width={128}
                            height={128}
                            quality={50}
                            className="size-full object-cover"
                          />
                        ) : (
                          <span className="flex size-full items-center justify-center bg-surface px-1 text-center text-[10px] text-faint">
                            Preview unavailable
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
