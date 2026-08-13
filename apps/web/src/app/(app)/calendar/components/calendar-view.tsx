'use client';

import { useMemo, useState, useTransition, type DragEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isSameDay, isToday, parse, parseISO } from 'date-fns';
import {
  Camera,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Megaphone,
  Square,
} from 'lucide-react';
import { Card, Select } from '@/components/ui';
import type { Tone } from '@/components/ui';
import { cn } from '@/lib/utils';
import { dayLabel, dateParam, gigTouchesDay, timeLabel } from '@/lib/gigs/display';
import { GIG_STATUS_CHIPS, type GigRow } from '@/lib/gigs/types';
import { GIG_STATUS_LABELS, type SocialPlatform } from '@lensello/core';
import { POST_STATUS_TONES, PLATFORM_LABELS, formatTimestamp } from '@/lib/campaigns/display';
import type { CalendarPost, CalendarTask } from '@/lib/planner/calendar';
import { calendarHref, previousWeek, nextWeek, type CalendarViewMode } from '@/lib/planner/calendar-grid';
import { previousMonth, nextMonth } from '@/lib/gigs/display';
import { TASK_KIND_LABELS, TASK_KIND_TONES, taskStatus } from '@/lib/planner/display';
import type { CampaignRef } from '@/lib/planner/queries';
import { rescheduleCampaignTask } from '../../campaigns/planner-actions';

/** Same palette `Badge` uses, as solid chip backgrounds rather than pills. */
const TONE_CHIPS: Record<Tone, string> = {
  neutral: 'bg-surface-raised text-muted',
  accent: 'bg-accent-subtle text-accent',
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning',
  danger: 'bg-danger-subtle text-danger',
};

/**
 * `referenceDate`, the `days` array and `campaign_tasks.due_on` are all bare
 * `YYYY-MM-DD` values with no time component. `parseISO` treats a date-only
 * string as UTC midnight, and comparing that against a `Date` built from
 * local-time `format`/`parse` (as the month grid is) drifts by a day for
 * anyone west of UTC. Every bare date in this file goes through this instead,
 * which reads it in the viewer's own local time — the same convention
 * `format(date, 'yyyy-MM-dd')` uses to write it.
 */
function parseLocalDate(value: string): Date {
  return parse(value, 'yyyy-MM-dd', new Date());
}

type EventKind = 'gig' | 'post' | 'task';
const KIND_LABELS: Record<EventKind, string> = { gig: 'Gigs', post: 'Posts', task: 'Tasks' };

interface CalendarViewProps {
  view: CalendarViewMode;
  referenceDate: string;
  days: string[];
  monthLabel: string;
  weekdayHeadings: { short: string; long: string }[];
  gigs: GigRow[];
  posts: CalendarPost[];
  tasks: CalendarTask[];
  campaigns: CampaignRef[];
  campaignFilter: string | null;
}

export function CalendarView({
  view,
  referenceDate,
  days: dayIsos,
  monthLabel: currentMonthLabel,
  weekdayHeadings: headings,
  gigs,
  posts,
  tasks,
  campaigns,
  campaignFilter,
}: CalendarViewProps) {
  const router = useRouter();
  const [visible, setVisible] = useState<Record<EventKind, boolean>>({
    gig: true,
    post: true,
    task: true,
  });
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Optimistic local copy so a drag-drop feels instant instead of waiting on
  // the round trip through `revalidatePath` + a fresh server render. Resynced
  // during render (React's documented pattern for "adjusting state when a
  // prop changes") rather than in an effect, so it happens in the same
  // commit as the new `tasks` prop instead of one render later.
  const [localTasks, setLocalTasks] = useState(tasks);
  const [syncedTasks, setSyncedTasks] = useState(tasks);
  if (tasks !== syncedTasks) {
    setSyncedTasks(tasks);
    setLocalTasks(tasks);
  }

  const reference = useMemo(() => parseLocalDate(referenceDate), [referenceDate]);
  const days = useMemo(() => dayIsos.map((iso) => parseLocalDate(iso)), [dayIsos]);

  const filteredPosts = campaignFilter
    ? posts.filter((post) => post.campaignId === campaignFilter)
    : posts;
  const filteredTasks = campaignFilter
    ? localTasks.filter((task) => task.campaign_id === campaignFilter)
    : localTasks;
  // Gigs never belong to a campaign; filtering to one hides them, which is
  // the point — "what is this campaign doing right now" should not be
  // cluttered with unrelated bookings.
  const filteredGigs = campaignFilter ? [] : gigs;

  function toggleKind(kind: EventKind) {
    setVisible((current) => ({ ...current, [kind]: !current[kind] }));
  }

  function handleCampaignChange(value: string) {
    router.push(calendarHref({ view, date: referenceDate, campaignId: value || null }));
  }

  function handleDrop(dayIso: string, event: DragEvent) {
    event.preventDefault();
    setDragOverDay(null);
    const taskId = event.dataTransfer.getData('text/plain');
    if (!taskId) return;
    const dueOn = dateParam(parseISO(dayIso));

    const previousTasks = localTasks;
    setLocalTasks((current) =>
      current.map((task) => (task.id === taskId ? { ...task, due_on: dueOn } : task)),
    );

    startTransition(async () => {
      const result = await rescheduleCampaignTask(taskId, dueOn);
      if (result.error) {
        setLocalTasks(previousTasks);
      } else {
        router.refresh();
      }
    });
  }

  const previousHref = calendarHref({
    view,
    date: view === 'week' ? previousWeek(reference) : previousMonth(reference),
    campaignId: campaignFilter,
  });
  const nextHref = calendarHref({
    view,
    date: view === 'week' ? nextWeek(reference) : nextMonth(reference),
    campaignId: campaignFilter,
  });
  const todayHref = calendarHref({ view, campaignId: campaignFilter });

  return (
    <div className={cn('space-y-4', pending && 'opacity-90')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          {(['month', 'week'] as const).map((mode) => (
            <Link
              key={mode}
              href={calendarHref({
                view: mode,
                date: referenceDate,
                campaignId: campaignFilter,
              })}
              aria-current={view === mode ? 'page' : undefined}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                view === mode
                  ? 'bg-accent-subtle text-accent'
                  : 'text-muted hover:bg-surface-hover hover:text-foreground',
              )}
            >
              {mode}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            {(['gig', 'post', 'task'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => toggleKind(kind)}
                aria-pressed={visible[kind]}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  visible[kind]
                    ? 'border-strong bg-surface text-foreground'
                    : 'border-subtle bg-surface-raised text-faint',
                )}
              >
                {KIND_LABELS[kind]}
              </button>
            ))}
          </div>

          {campaigns.length > 0 ? (
            <Select
              aria-label="Filter by campaign"
              value={campaignFilter ?? ''}
              onChange={(event) => handleCampaignChange(event.target.value)}
              className="h-8 max-w-[12rem] text-xs"
            >
              <option value="">All campaigns</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </Select>
          ) : null}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-3">
          <Link
            href={previousHref}
            aria-label={view === 'week' ? 'Previous week' : 'Previous month'}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-strong px-2 text-xs font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <ChevronLeft size={15} aria-hidden="true" />
            Prev
          </Link>

          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-foreground" aria-live="polite">
              {view === 'week'
                ? `${dayLabel(days[0]!)} – ${dayLabel(days[6]!)}`
                : currentMonthLabel}
            </h2>
            <Link
              href={todayHref}
              className="text-xs font-medium text-accent hover:underline"
            >
              Today
            </Link>
          </div>

          <Link
            href={nextHref}
            aria-label={view === 'week' ? 'Next week' : 'Next month'}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-strong px-2 text-xs font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            Next
            <ChevronRight size={15} aria-hidden="true" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[50rem] table-fixed border-collapse text-left">
            <caption className="sr-only">
              {view === 'week' ? 'Week' : 'Month'} calendar
            </caption>
            <thead>
              <tr>
                {headings.map((heading) => (
                  <th
                    key={heading.long}
                    scope="col"
                    className="border-b border-subtle px-2 py-2 text-xs font-medium text-muted"
                  >
                    <span aria-hidden="true">{heading.short}</span>
                    <span className="sr-only">{heading.long}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chunk(days, 7).map((week) => (
                <tr key={week[0]!.toISOString()}>
                  {week.map((day) => (
                    <DayCell
                      key={day.toISOString()}
                      day={day}
                      inRange={view === 'week' || isSameMonthAs(day, reference)}
                      compact={view === 'month'}
                      gigs={visible.gig ? filteredGigs : []}
                      posts={visible.post ? filteredPosts : []}
                      tasks={visible.task ? filteredTasks : []}
                      isDragOver={dragOverDay === day.toISOString()}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragOverDay(day.toISOString());
                      }}
                      onDragLeave={() => setDragOverDay(null)}
                      onDrop={(event) => handleDrop(day.toISOString(), event)}
                      campaignFilter={campaignFilter}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function isSameMonthAs(day: Date, reference: Date): boolean {
  return day.getMonth() === reference.getMonth() && day.getFullYear() === reference.getFullYear();
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function DayCell({
  day,
  inRange,
  compact,
  gigs,
  posts,
  tasks,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  campaignFilter,
}: {
  day: Date;
  inRange: boolean;
  compact: boolean;
  gigs: GigRow[];
  posts: CalendarPost[];
  tasks: CalendarTask[];
  isDragOver: boolean;
  onDragOver: (event: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent) => void;
  campaignFilter: string | null;
}) {
  const dayGigs = gigs.filter((gig) => gigTouchesDay(gig, day));
  const dayPosts = posts.filter((post) => {
    const at = post.scheduledForIso ?? post.publishedAtIso;
    return at ? isSameDay(parseISO(at), day) : false;
  });
  const dayTasks = tasks.filter((task) => task.due_on && isSameDay(parseLocalDate(task.due_on), day));

  const total = dayGigs.length + dayPosts.length + dayTasks.length;
  const cap = compact ? 4 : 20;
  const visibleGigs = dayGigs.slice(0, cap);
  const remainingAfterGigs = Math.max(0, cap - visibleGigs.length);
  const visiblePosts = dayPosts.slice(0, remainingAfterGigs);
  const remainingAfterPosts = Math.max(0, remainingAfterGigs - visiblePosts.length);
  const visibleTasks = dayTasks.slice(0, remainingAfterPosts);
  const overflow = total - visibleGigs.length - visiblePosts.length - visibleTasks.length;

  return (
    <td
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'border-b border-r px-1.5 py-1.5 align-top last:border-r-0',
        compact ? 'h-32' : 'h-56',
        inRange ? 'bg-surface' : 'bg-canvas',
        isDragOver && 'bg-accent-subtle/60 ring-1 ring-inset ring-accent',
      )}
    >
      <div className="mb-1 flex items-center justify-between">
        <span
          className={cn(
            'inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums',
            isToday(day) ? 'bg-accent text-accent-foreground' : 'text-muted',
          )}
        >
          {day.getDate()}
        </span>
        {overflow > 0 ? (
          <span className="pr-0.5 text-[10px] text-faint">+{overflow} more</span>
        ) : null}
      </div>

      <ul className="space-y-1">
        {visibleGigs.map((gig) => (
          <li key={`gig-${gig.id}`}>
            <Link
              href={`/gigs/${gig.id}`}
              title={`${gig.title} · ${GIG_STATUS_LABELS[gig.status]} · ${dayLabel(day)}`}
              className={cn(
                'flex items-center gap-1 truncate rounded px-1.5 py-1 text-[11px] leading-tight font-medium transition-opacity hover:opacity-80',
                GIG_STATUS_CHIPS[gig.status],
              )}
            >
              <Camera size={10} className="shrink-0" aria-hidden="true" />
              <span className="tabular-nums opacity-70">{timeLabel(gig.starts_at)}</span>
              <span className="truncate">{gig.title}</span>
            </Link>
          </li>
        ))}

        {visiblePosts.map((post) => (
          <li key={`post-${post.id}`}>
            <Link
              href={`/campaigns/${post.campaignId}`}
              title={`${PLATFORM_LABELS[post.platform as SocialPlatform] ?? post.platform} post for ${post.campaignName}${
                post.scheduledForIso ? ` · ${formatTimestamp(post.scheduledForIso)}` : ''
              }`}
              className={cn(
                'flex items-center gap-1 truncate rounded px-1.5 py-1 text-[11px] leading-tight font-medium transition-opacity hover:opacity-80',
                TONE_CHIPS[POST_STATUS_TONES[post.status as keyof typeof POST_STATUS_TONES] ?? 'neutral'],
              )}
            >
              <Megaphone size={10} className="shrink-0" aria-hidden="true" />
              <span className="truncate">
                {campaignFilter ? '' : `${post.campaignName} · `}
                {PLATFORM_LABELS[post.platform as SocialPlatform] ?? post.platform}
              </span>
            </Link>
          </li>
        ))}

        {visibleTasks.map((task) => {
          const status = taskStatus(task, dateParam(new Date()));
          const done = Boolean(task.done_at);
          return (
            <li key={`task-${task.id}`}>
              <Link
                href={`/campaigns/${task.campaign_id}`}
                draggable={!done}
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', task.id);
                  event.dataTransfer.effectAllowed = 'move';
                }}
                title={`${task.title} · ${TASK_KIND_LABELS[task.kind]} · ${campaignFilter ? '' : task.campaignName}`}
                className={cn(
                  'flex items-center gap-1 truncate rounded px-1.5 py-1 text-[11px] leading-tight font-medium transition-opacity hover:opacity-80',
                  done
                    ? 'bg-surface-raised text-faint line-through'
                    : TONE_CHIPS[TASK_KIND_TONES[task.kind]],
                  !done && status === 'overdue' && 'ring-1 ring-inset ring-danger',
                  !done && 'cursor-grab active:cursor-grabbing',
                )}
              >
                {done ? (
                  <CheckSquare size={10} className="shrink-0" aria-hidden="true" />
                ) : (
                  <Square size={10} className="shrink-0" aria-hidden="true" />
                )}
                <span className="truncate">
                  {campaignFilter ? '' : `${task.campaignName} · `}
                  {task.title}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </td>
  );
}
