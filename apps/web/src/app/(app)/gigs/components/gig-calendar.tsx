import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { isSameMonth, isToday } from 'date-fns';
import { GIG_STATUS_LABELS, type GigStatus } from '@lensello/core';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  dateParam,
  dayLabel,
  dayNumber,
  gigTouchesDay,
  gigsHref,
  monthGrid,
  monthLabel,
  nextMonth,
  previousMonth,
  shortTimeLabel,
  timeLabel,
  weekdayHeadings,
} from '@/lib/gigs/display';
import { GIG_STATUS_CHIPS, type GigRow } from '@/lib/gigs/types';

/**
 * Month calendar.
 *
 * A real `<table>`: weekday `<th scope="col">`, one `<td>` per day, a `<caption>`
 * naming the month. Everything actionable is a link, so the whole grid is
 * reachable with Tab alone and a screen reader announces "row 3, column
 * Saturday" without any ARIA of our own. Month navigation is `<Link>`-based
 * rather than stateful, which is what makes the view linkable and the browser's
 * back button work.
 */
export function GigCalendar({
  month,
  gigs,
  status,
}: {
  month: Date;
  gigs: GigRow[];
  status: GigStatus | null;
}) {
  const weeks = monthGrid(month);
  const headings = weekdayHeadings();

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-3">
        <Link
          href={gigsHref({ view: 'calendar', month: previousMonth(month), status })}
          aria-label={`Go to ${monthLabel(previousMonth(month))}`}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-strong px-2 text-xs font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <ChevronLeft size={15} aria-hidden="true" />
          Prev
        </Link>

        <h2 className="text-sm font-semibold text-foreground" aria-live="polite">
          {monthLabel(month)}
        </h2>

        <Link
          href={gigsHref({ view: 'calendar', month: nextMonth(month), status })}
          aria-label={`Go to ${monthLabel(nextMonth(month))}`}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-strong px-2 text-xs font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          Next
          <ChevronRight size={15} aria-hidden="true" />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] table-fixed border-collapse text-left">
          <caption className="sr-only">
            Gigs in {monthLabel(month)}
            {status ? `, filtered to ${GIG_STATUS_LABELS[status].toLowerCase()}` : ''}
          </caption>

          <thead>
            <tr>
              {headings.map((heading) => (
                <th
                  key={heading.long}
                  scope="col"
                  className="border-b border-subtle px-2 py-2 text-xs font-medium text-muted"
                >
                  {/* The single letter is decorative; the full name is what a
                      screen reader should hear for the column. */}
                  <span aria-hidden="true">{heading.short}</span>
                  <span className="sr-only">{heading.long}</span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {weeks.map((week) => (
              <tr key={week.days[0]!.toISOString()}>
                {week.days.map((day) => {
                  const inMonth = isSameMonth(day, month);
                  const dayGigs = gigs.filter((gig) => gigTouchesDay(gig, day));
                  const today = isToday(day);

                  return (
                    <td
                      key={day.toISOString()}
                      className={cn(
                        'h-28 border-b border-subtle align-top last:border-r-0',
                        'border-r px-1.5 py-1.5',
                        inMonth ? 'bg-surface' : 'bg-canvas',
                      )}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        {inMonth ? (
                          <Link
                            href={`/gigs/new?date=${dateParam(day)}`}
                            aria-label={`Add a gig on ${dayLabel(day)}`}
                            title={`Add a gig on ${dayLabel(day)}`}
                            className={cn(
                              'inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums transition-colors',
                              today
                                ? 'bg-accent text-accent-foreground'
                                : 'text-muted hover:bg-surface-hover hover:text-foreground',
                            )}
                          >
                            {dayNumber(day)}
                          </Link>
                        ) : (
                          <span className="inline-flex h-6 min-w-6 items-center justify-center px-1 text-xs tabular-nums text-faint">
                            {dayNumber(day)}
                          </span>
                        )}

                        {dayGigs.length > 2 ? (
                          <span className="pr-0.5 text-[10px] text-faint">
                            {dayGigs.length}
                          </span>
                        ) : null}
                      </div>

                      {dayGigs.length > 0 ? (
                        <ul className="space-y-1">
                          {dayGigs.map((gig) => (
                            <li key={gig.id}>
                              <Link
                                href={`/gigs/${gig.id}`}
                                aria-label={`${gig.title}, ${GIG_STATUS_LABELS[gig.status]}, ${timeLabel(gig.starts_at)} on ${dayLabel(day)}`}
                                className={cn(
                                  'block truncate rounded px-1.5 py-1 text-[11px] leading-tight font-medium transition-opacity hover:opacity-80',
                                  GIG_STATUS_CHIPS[gig.status],
                                )}
                              >
                                <span className="tabular-nums opacity-70">
                                  {shortTimeLabel(gig.starts_at)}
                                </span>{' '}
                                {gig.title}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CalendarLegend />
    </Card>
  );
}

function CalendarLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-subtle px-4 py-3">
      <span className="text-xs font-medium text-muted">Status</span>
      {(Object.keys(GIG_STATUS_CHIPS) as GigStatus[]).map((status) => (
        <span key={status} className="flex items-center gap-1.5 text-xs text-muted">
          <span
            aria-hidden="true"
            className={cn('h-2.5 w-2.5 rounded-full', GIG_STATUS_CHIPS[status])}
          />
          {GIG_STATUS_LABELS[status]}
        </span>
      ))}
    </div>
  );
}
