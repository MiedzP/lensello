import Image from 'next/image';
import Link from 'next/link';
import { ImageOff, MapPin, Star, User } from 'lucide-react';
import { SHOOT_TYPE_LABELS } from '@lensello/core';
import { Badge } from '@/components/ui';
import { pluralize } from '@/lib/utils';
import {
  SHOOT_STATUS_LABELS,
  SHOOT_STATUS_TONES,
  formatDate,
} from '@/lib/library/constants';
import type { ShootListItem } from '@/lib/library/queries';

/**
 * One shoot in the index grid. Server Component — no interactivity beyond the
 * link, so there is nothing to hydrate.
 */
export function ShootCard({ shoot }: { shoot: ShootListItem }) {
  const shotOn = formatDate(shoot.shotAt);

  return (
    <Link
      href={`/library/${shoot.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-subtle bg-surface transition-colors hover:border-strong"
    >
      <div className="relative aspect-4/3 w-full bg-surface-raised">
        {shoot.coverUrl ? (
          <Image
            src={shoot.coverUrl}
            alt=""
            fill
            quality={50}
            sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 90vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-faint">
            <ImageOff size={22} aria-hidden="true" />
            <span className="sr-only">No photos yet</span>
          </div>
        )}

        {shoot.selectCount > 0 ? (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-canvas/85 px-2 py-0.5 text-xs font-medium text-foreground">
            <Star size={11} aria-hidden="true" className="text-accent" />
            {shoot.selectCount}
            <span className="sr-only">selects</span>
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="truncate text-sm font-semibold text-foreground group-hover:text-accent">
            {shoot.title}
          </h2>
          <Badge tone={SHOOT_STATUS_TONES[shoot.status]}>
            {SHOOT_STATUS_LABELS[shoot.status]}
          </Badge>
        </div>

        <p className="text-xs text-muted">
          {SHOOT_TYPE_LABELS[shoot.type]}
          {shotOn ? ` · ${shotOn}` : ' · No date'}
          {` · ${pluralize(shoot.assetCount, 'photo')}`}
        </p>

        {shoot.clientName || shoot.location ? (
          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
            {shoot.clientName ? (
              <span className="inline-flex min-w-0 items-center gap-1">
                <User size={12} aria-hidden="true" />
                <span className="truncate">{shoot.clientName}</span>
              </span>
            ) : null}
            {shoot.location ? (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin size={12} aria-hidden="true" />
                <span className="truncate">{shoot.location}</span>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
