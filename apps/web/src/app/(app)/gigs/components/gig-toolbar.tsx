import Link from 'next/link';
import { CalendarDays, List } from 'lucide-react';
import { GIG_STATUSES, GIG_STATUS_LABELS, type GigStatus } from '@lensello/core';
import { cn } from '@/lib/utils';
import { gigsHref, toMonthParam, type GigsView } from '@/lib/gigs/display';

/**
 * View switch and status filter, both as links.
 *
 * Everything lives in searchParams: the current view, month, and filter are all
 * in the URL, so a particular month's confirmed gigs is a page you can bookmark
 * and the back button undoes a filter change.
 */
export function GigToolbar({
  view,
  month,
  status,
}: {
  view: GigsView;
  month: Date;
  status: GigStatus | null;
}) {
  const monthParam = toMonthParam(month);

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="View" className="flex items-center gap-1 rounded-md border border-strong p-0.5">
        <ViewLink
          href={gigsHref({ view: 'calendar', month: monthParam, status })}
          isActive={view === 'calendar'}
          icon={<CalendarDays size={15} aria-hidden="true" />}
          label="Calendar"
        />
        <ViewLink
          href={gigsHref({ view: 'list', month: monthParam, status })}
          isActive={view === 'list'}
          icon={<List size={15} aria-hidden="true" />}
          label="List"
        />
      </nav>

      <nav aria-label="Filter by status" className="flex flex-wrap items-center gap-1.5">
        <FilterLink
          href={gigsHref({ view, month: monthParam, status: null })}
          isActive={status === null}
          label="All"
        />
        {GIG_STATUSES.map((option) => (
          <FilterLink
            key={option}
            href={gigsHref({ view, month: monthParam, status: option })}
            isActive={status === option}
            label={GIG_STATUS_LABELS[option]}
          />
        ))}
      </nav>
    </div>
  );
}

function ViewLink({
  href,
  isActive,
  icon,
  label,
}: {
  href: `/gigs` | `/gigs?${string}`;
  isActive: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors',
        isActive
          ? 'bg-accent-subtle text-accent'
          : 'text-muted hover:bg-surface-hover hover:text-foreground',
      )}
    >
      {icon}
      {label}
    </Link>
  );
}

function FilterLink({
  href,
  isActive,
  label,
}: {
  href: `/gigs` | `/gigs?${string}`;
  isActive: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium transition-colors',
        isActive
          ? 'border-accent bg-accent-subtle text-accent'
          : 'border-subtle text-muted hover:bg-surface-hover hover:text-foreground',
      )}
    >
      {label}
    </Link>
  );
}
