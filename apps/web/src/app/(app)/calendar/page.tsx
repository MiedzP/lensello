import type { Metadata } from 'next';
import { CalendarDays } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { monthGrid, monthLabel, weekdayHeadings } from '@/lib/gigs/display';
import { loadCalendarData } from '@/lib/planner/calendar';
import {
  parseCalendarView,
  parseReferenceDate,
  referenceDateParam,
  weekDays,
  weekRange,
} from '@/lib/planner/calendar-grid';
import { listCampaignRefs, listRunningCampaigns } from '@/lib/planner/queries';
import { CalendarView } from './components/calendar-view';
import { RunningNow } from './components/running-now';

export const metadata: Metadata = { title: 'Calendar' };

/**
 * `/calendar` — gigs, scheduled posts and campaign tasks in one month or week
 * grid.
 *
 * The visible window drives the query, not the other way round: month view
 * asks for the whole rendered grid (including the leading/trailing days from
 * neighbouring months, same as the gigs calendar), week view asks for exactly
 * that week. There is no calendar table to page through — every row here is
 * read live from `gigs`, `campaign_posts` and `campaign_tasks`.
 */
export default async function CalendarPage(props: PageProps<'/calendar'>) {
  const { supabase } = await requireUserOrRedirect();
  const searchParams = await props.searchParams;

  const view = parseCalendarView(searchParams.view);
  const referenceDate = parseReferenceDate(searchParams.date);
  const campaignFilter =
    typeof searchParams.campaign === 'string' ? searchParams.campaign : null;

  let days: Date[];
  let fromIso: string;
  let toIso: string;

  if (view === 'week') {
    const { start, end } = weekRange(referenceDate);
    days = weekDays(referenceDate);
    fromIso = start.toISOString();
    toIso = end.toISOString();
  } else {
    const weeks = monthGrid(referenceDate);
    days = weeks.flatMap((week) => week.days);
    fromIso = days[0]!.toISOString();
    toIso = days[days.length - 1]!.toISOString();
  }

  const fromDate = referenceDateParam(days[0]!);
  const toDate = referenceDateParam(days[days.length - 1]!);

  const [data, campaigns, runningCampaigns] = await Promise.all([
    loadCalendarData(supabase, { fromIso, toIso, fromDate, toDate }),
    listCampaignRefs(supabase),
    listRunningCampaigns(supabase, referenceDateParam(new Date())),
  ]);

  const isEmpty =
    data.gigs.length === 0 && data.posts.length === 0 && data.tasks.length === 0;

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Everything dated in one place: shoots, scheduled posts and campaign tasks."
      />

      {runningCampaigns.length > 0 ? (
        <RunningNow campaigns={runningCampaigns} activeCampaignId={campaignFilter} />
      ) : null}

      <CalendarView
        view={view}
        referenceDate={referenceDateParam(referenceDate)}
        days={days.map((day) => referenceDateParam(day))}
        monthLabel={monthLabel(referenceDate)}
        weekdayHeadings={weekdayHeadings()}
        gigs={data.gigs}
        posts={data.posts}
        tasks={data.tasks}
        campaigns={campaigns}
        campaignFilter={campaignFilter}
      />

      {isEmpty ? (
        <div className="mt-5">
          <EmptyState
            icon={<CalendarDays size={22} aria-hidden="true" />}
            title="Nothing on the calendar in this window"
            description="Gigs, scheduled posts and campaign checklist items all show up here the moment they have a date."
          />
        </div>
      ) : null}
    </>
  );
}
