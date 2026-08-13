'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { Check, ImageOff, Library, X } from 'lucide-react';
import { Badge, Button, Select } from '@/components/ui';
import { cn } from '@/lib/utils';
import { DECISION_LABELS, DECISION_TONES, type Decision } from '@/lib/studio/constants';
import type { ShootOption } from '@/lib/studio/queries';
import type { GeneratedImageView } from '@/lib/studio/types';
import { decideGeneratedImage, promoteGeneratedImage } from '../../actions';

/**
 * One generated image: decide on it, and — only once approved — promote it.
 *
 * Promotion is the one path a synthetic image can reach `assets` by, and it
 * is deliberately a second, separate click from "approve": approving says
 * "this is good enough to consider", filing it says "put this in the
 * library", and those are not the same decision.
 */
export function GeneratedImageCard({
  image,
  shootOptions,
}: {
  image: GeneratedImageView;
  shootOptions: ShootOption[];
}) {
  const [decision, setDecision] = useState<Decision>(image.decision);
  const [assetId, setAssetId] = useState<string | null>(image.assetId);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [promoteShootId, setPromoteShootId] = useState(shootOptions[0]?.id ?? '');

  function decide(next: Decision) {
    startTransition(async () => {
      const result = await decideGeneratedImage(image.id, next as 'approved' | 'rejected');
      setError(result.error);
      if (!result.error) setDecision(next);
    });
  }

  function promote() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('imageId', image.id);
      formData.set('shootId', promoteShootId);
      const result = await promoteGeneratedImage({ error: null, message: null }, formData);
      setError(result.error);
      if (!result.error) setAssetId('promoted');
    });
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-subtle bg-surface">
      <div className="relative aspect-square bg-surface-raised">
        {image.url ? (
          <Image src={image.url} alt="" fill sizes="240px" className="object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-faint">
            <ImageOff size={20} aria-hidden="true" />
          </span>
        )}
        <Badge tone="warning" className="absolute top-2 left-2">
          Generated
        </Badge>
        <Badge tone={DECISION_TONES[decision]} className="absolute top-2 right-2">
          {DECISION_LABELS[decision]}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 text-xs text-muted">{image.prompt}</p>
        {error ? <p className="text-xs text-danger">{error}</p> : null}

        <div className="mt-auto flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => decide('approved')}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
              decision === 'approved'
                ? 'border-success bg-success-subtle text-success'
                : 'border-strong text-foreground hover:bg-surface-hover',
            )}
          >
            <Check size={13} aria-hidden="true" />
            Approve
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => decide('rejected')}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
              decision === 'rejected'
                ? 'border-danger bg-danger-subtle text-danger'
                : 'border-strong text-foreground hover:bg-surface-hover',
            )}
          >
            <X size={13} aria-hidden="true" />
            Reject
          </button>
        </div>

        {decision === 'approved' ? (
          assetId ? (
            <p className="text-xs text-success">Added to the library.</p>
          ) : (
            <div className="flex gap-2">
              <Select
                value={promoteShootId}
                onChange={(event) => setPromoteShootId(event.target.value)}
                className="h-8 text-xs"
                aria-label="Shoot to file this under"
              >
                {shootOptions.map((shoot) => (
                  <option key={shoot.id} value={shoot.id}>
                    {shoot.title}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                size="sm"
                disabled={pending || !promoteShootId}
                onClick={promote}
              >
                <Library size={13} aria-hidden="true" />
                Add to library
              </Button>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
