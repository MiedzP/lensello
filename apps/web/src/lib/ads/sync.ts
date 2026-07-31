import type { AdMetric, DateOnly } from '@lensello/core';
import type { TablesInsert } from '@/lib/db.types';

/**
 * Pure helpers for metric sync. Kept out of the action so the tricky parts —
 * window arithmetic and the idempotency-critical row shaping — are testable and
 * readable on their own.
 */

/** Today in UTC as `YYYY-MM-DD`. Metric days are dates, not instants. */
export function today(now: Date = new Date()): DateOnly {
  return now.toISOString().slice(0, 10);
}

export function addDays(day: DateOnly, delta: number): DateOnly {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export interface SyncWindow {
  from: DateOnly;
  to: DateOnly;
}

/**
 * The window to request for one ad.
 *
 * Starts from the requested lookback, then clamps to the ad's own flight: there
 * are no impressions before an ad started or after it ended, and asking for
 * them invites an adapter to invent them. Returns null when the clamp leaves
 * nothing — an ad that finished before the window opened is skipped, not
 * errored.
 */
export function resolveSyncWindow(
  ad: { starts_on: string | null; ends_on: string | null },
  days: number,
  now: Date = new Date(),
): SyncWindow | null {
  const to = today(now);
  const from = addDays(to, -(days - 1));

  const clampedFrom = ad.starts_on && ad.starts_on > from ? ad.starts_on : from;
  const clampedTo = ad.ends_on && ad.ends_on < to ? ad.ends_on : to;

  if (clampedFrom > clampedTo) return null;
  return { from: clampedFrom, to: clampedTo };
}

/** What the adapter hands back: a day's numbers, with no ad attribution. */
type FetchedMetric = Omit<AdMetric, 'id' | 'adId'>;

/**
 * Shapes adapter output into `ad_metrics` insert rows.
 *
 * Three things happen here, all of them load-bearing:
 *
 * 1. **No `id`.** The upsert must match on `(ad_id, day)`. Supplying a fresh
 *    `gen_random_uuid()` would make every row look new to the primary key and
 *    turn a re-sync into a unique-violation instead of an update.
 * 2. **Deduplicated by day.** Postgres refuses an `ON CONFLICT DO UPDATE` that
 *    would touch the same row twice in one statement ("cannot affect row a
 *    second time"), so two rows for one day in a single payload would fail the
 *    whole batch. Last value for a day wins.
 * 3. **Clamped.** `ad_metrics_clicks_within_impressions` rejects clicks above
 *    impressions, and the count/spend columns reject negatives. An adapter that
 *    returns something incoherent should produce a corrected row, not abort the
 *    user's sync.
 */
export function toMetricInserts(
  adId: string,
  fetched: readonly FetchedMetric[],
  window: SyncWindow,
): TablesInsert<'ad_metrics'>[] {
  const byDay = new Map<string, TablesInsert<'ad_metrics'>>();

  for (const row of fetched) {
    // Trust the window we asked for over the days we were handed.
    if (row.day < window.from || row.day > window.to) continue;

    const impressions = Math.max(0, Math.round(row.impressions));
    const clicks = Math.min(impressions, Math.max(0, Math.round(row.clicks)));

    byDay.set(row.day, {
      ad_id: adId,
      day: row.day,
      impressions,
      clicks,
      spend_cents: Math.max(0, Math.round(row.spendCents)),
      leads: Math.max(0, Math.round(row.leads)),
    });
  }

  return [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
}

/** "3 ads, 90 days" — the sentence the sync control reports back. */
export function describeSyncResult(input: {
  adsSynced: number;
  daysWritten: number;
  skipped: number;
}): string {
  const { adsSynced, daysWritten, skipped } = input;

  if (adsSynced === 0) {
    return skipped > 0
      ? `Nothing to sync. ${skipped === 1 ? 'That ad has' : `${skipped} ads have`} not been launched to a platform yet.`
      : 'Nothing to sync yet.';
  }

  const core =
    `Synced ${daysWritten} ${daysWritten === 1 ? 'day' : 'days'} of performance ` +
    `across ${adsSynced} ${adsSynced === 1 ? 'ad' : 'ads'}.`;

  return skipped > 0
    ? `${core} Skipped ${skipped} not yet launched.`
    : core;
}
