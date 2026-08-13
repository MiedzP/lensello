import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Card, CardBody } from '@/components/ui';
import { ModuleIcon } from '@/lib/academy/icons';
import type { ModuleWithStats } from '@/lib/academy/queries';
import { PublishBadge } from './badges';

export function ModuleCard({ module: mod }: { module: ModuleWithStats }) {
  const pct = mod.lessonCount === 0 ? 0 : Math.round((mod.completedCount / mod.lessonCount) * 100);

  return (
    <Link href={`/academy/${mod.slug}`} className="block">
      <Card className="h-full transition-colors hover:bg-surface-hover">
        <CardBody className="flex h-full flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent"
              style={mod.accent_color ? { color: mod.accent_color } : undefined}
              aria-hidden="true"
            >
              <ModuleIcon iconName={mod.icon} size={18} />
            </div>
            <PublishBadge isPublished={mod.is_published} />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-foreground">{mod.title}</h2>
            {mod.summary ? (
              <p className="mt-1 text-xs text-muted line-clamp-2">{mod.summary}</p>
            ) : null}
          </div>

          <div className="mt-auto flex items-center justify-between gap-2 text-xs text-muted">
            <span>
              {mod.lessonCount === 0
                ? 'No lessons yet'
                : `${mod.completedCount}/${mod.lessonCount} lessons complete`}
            </span>
            <ChevronRight size={14} aria-hidden="true" />
          </div>

          {mod.lessonCount > 0 ? (
            <div
              className="h-1 w-full overflow-hidden rounded-full bg-surface-raised"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
          ) : null}
        </CardBody>
      </Card>
    </Link>
  );
}
