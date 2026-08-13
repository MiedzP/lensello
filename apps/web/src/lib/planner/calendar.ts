/**
 * Loads everything the calendar draws: gigs, scheduled posts, and campaign
 * tasks over one visible window.
 *
 * There is no calendar table — the migration is explicit that a fourth copy
 * of the same dates would only drift. This assembles the view from the three
 * sources that already carry a date: `gigs` (read-only; owned by the gigs
 * module), `campaign_posts.scheduled_for`, and `campaign_tasks.due_on`.
 * Campaign names are joined in JS, matching the no-embedded-relationships
 * convention the rest of the app follows.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db.types';
import { listGigsOverlapping } from '@/lib/gigs/queries';
import type { GigRow } from '@/lib/gigs/types';
import { listPostsScheduledBetween, mapCampaignsById } from '@/lib/campaigns/queries';
import { listCampaignTasksDueBetween } from './queries';
import type { CampaignTaskRow } from './types';

type Db = SupabaseClient<Database>;

export interface CalendarPost {
  id: string;
  campaignId: string;
  campaignName: string;
  platform: string;
  status: string;
  scheduledForIso: string | null;
  publishedAtIso: string | null;
  caption: string;
}

export interface CalendarTask extends CampaignTaskRow {
  campaignName: string;
}

export interface CalendarWindow {
  /** Half-open instant range, for gigs and posts (`timestamptz`). */
  fromIso: string;
  toIso: string;
  /** Inclusive date range, for tasks (`date`). */
  fromDate: string;
  toDate: string;
}

export interface CalendarData {
  gigs: GigRow[];
  posts: CalendarPost[];
  tasks: CalendarTask[];
  /** Campaign id -> name, for gigs/posts/tasks alike. */
  campaignNames: Map<string, string>;
}

export async function loadCalendarData(
  db: Db,
  window: CalendarWindow,
): Promise<CalendarData> {
  const [gigs, posts, tasks] = await Promise.all([
    listGigsOverlapping(db, window.fromIso, window.toIso),
    listPostsScheduledBetween(db, window.fromIso, window.toIso),
    listCampaignTasksDueBetween(db, window.fromDate, window.toDate),
  ]);

  const campaigns = await mapCampaignsById(db, [
    ...posts.map((post) => post.campaign_id),
    ...tasks.map((task) => task.campaign_id),
  ]);

  const nameOf = (campaignId: string) => campaigns.get(campaignId)?.name ?? 'Untitled campaign';

  return {
    gigs,
    posts: posts.map((post) => ({
      id: post.id,
      campaignId: post.campaign_id,
      campaignName: nameOf(post.campaign_id),
      platform: post.platform,
      status: post.status,
      scheduledForIso: post.scheduled_for,
      publishedAtIso: post.published_at,
      caption: post.caption,
    })),
    tasks: tasks.map((task) => ({ ...task, campaignName: nameOf(task.campaign_id) })),
    campaignNames: new Map([...campaigns.entries()].map(([id, row]) => [id, row.name])),
  };
}
