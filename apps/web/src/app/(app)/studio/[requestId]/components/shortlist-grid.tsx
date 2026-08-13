'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { Check, ImageOff, X } from 'lucide-react';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { DECISION_LABELS, DECISION_TONES, type Decision } from '@/lib/studio/constants';
import type { ShortlistItemView } from '@/lib/studio/types';
import { decideShortlistItem } from '../../actions';

/**
 * The shortlist review grid.
 *
 * Every tile carries its rationale below the photo, not behind a tooltip —
 * "trust me" is not reviewable, and a reason that requires hovering to find
 * is close enough to invisible.
 */
export function ShortlistGrid({ items }: { items: ShortlistItemView[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-strong px-4 py-6 text-center text-sm text-muted">
        No photos matched this brief. Caption more of the library, or try different words.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <ShortlistTile key={item.id} item={item} />
      ))}
    </div>
  );
}

function ShortlistTile({ item }: { item: ShortlistItemView }) {
  const [decision, setDecision] = useState<Decision>(item.decision);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function decide(next: Decision) {
    startTransition(async () => {
      const result = await decideShortlistItem(item.id, next as 'approved' | 'rejected');
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setDecision(next);
    });
  }

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border bg-surface transition-colors',
        decision === 'approved' && 'border-success/50',
        decision === 'rejected' && 'border-danger/40 opacity-60',
        decision === 'pending' && 'border-subtle',
      )}
    >
      <div className="relative aspect-square bg-surface-raised">
        {item.url ? (
          <Image src={item.url} alt={item.altText ?? ''} fill sizes="240px" className="object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-faint">
            <ImageOff size={20} aria-hidden="true" />
          </span>
        )}
        <Badge tone={DECISION_TONES[decision]} className="absolute top-2 right-2">
          {DECISION_LABELS[decision]}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-3 text-xs text-muted">{item.rationale ?? 'No rationale recorded.'}</p>

        {error ? <p className="text-xs text-danger">{error}</p> : null}

        <div className="mt-auto flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => decide('approved')}
            aria-pressed={decision === 'approved'}
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
            aria-pressed={decision === 'rejected'}
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
      </div>
    </div>
  );
}
