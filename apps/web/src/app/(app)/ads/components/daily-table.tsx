import { summarize, type AdMetric } from '@lensello/core';
import {
  formatCostPerLead,
  formatCount,
  formatCtr,
  formatDayLong,
  formatSpend,
} from '@/lib/ads/format';

/**
 * Day-by-day performance for one ad.
 *
 * Also the accessible fallback for the charts above it — everything they draw is
 * a number in here. Newest day first, since that is what someone checking on an
 * ad wants; the charts read left-to-right oldest-first, which is the opposite
 * order and the right one for a time series.
 */

const NUMERIC = 'px-3 py-2 text-right text-sm tabular-nums whitespace-nowrap';
const NUMERIC_HEAD = 'px-3 py-2 text-right font-medium whitespace-nowrap';

export function DailyTable({
  metrics,
  adId,
}: {
  /** Oldest first; rendered newest first. */
  metrics: readonly AdMetric[];
  adId: string;
}) {
  const newestFirst = [...metrics].reverse();
  const total = summarize(metrics, adId);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-left">
        <caption className="px-3 pb-3 text-left text-xs text-muted">
          Daily performance. Per-day cost per lead is an em dash on days with no
          leads — a day that spent money and produced nothing has no cost per
          lead, which is not the same as a cost of zero.
        </caption>
        <thead>
          <tr className="border-b border-subtle text-xs text-muted">
            <th scope="col" className="px-3 py-2 font-medium">
              Day
            </th>
            <th scope="col" className={NUMERIC_HEAD}>
              Impressions
            </th>
            <th scope="col" className={NUMERIC_HEAD}>
              Clicks
            </th>
            <th scope="col" className={NUMERIC_HEAD}>
              CTR
            </th>
            <th scope="col" className={NUMERIC_HEAD}>
              Spend
            </th>
            <th scope="col" className={NUMERIC_HEAD}>
              Leads
            </th>
            <th scope="col" className={NUMERIC_HEAD}>
              Cost / lead
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-subtle">
          {newestFirst.map((metric) => {
            const day = summarize([metric], adId);
            return (
              <tr key={metric.day}>
                <th
                  scope="row"
                  className="px-3 py-2 text-sm font-normal whitespace-nowrap text-foreground"
                >
                  {formatDayLong(metric.day)}
                </th>
                <td className={NUMERIC}>{formatCount(metric.impressions)}</td>
                <td className={NUMERIC}>{formatCount(metric.clicks)}</td>
                <td className={NUMERIC}>
                  {formatCtr(day.ctr, day.impressions)}
                </td>
                <td className={NUMERIC}>{formatSpend(metric.spendCents)}</td>
                <td className={NUMERIC}>{formatCount(metric.leads)}</td>
                <td className={NUMERIC}>
                  {formatCostPerLead(day.costPerLeadCents)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-strong text-sm font-medium">
            <th scope="row" className="px-3 py-2 text-left">
              Total
            </th>
            <td className={NUMERIC}>{formatCount(total.impressions)}</td>
            <td className={NUMERIC}>{formatCount(total.clicks)}</td>
            <td className={NUMERIC}>{formatCtr(total.ctr, total.impressions)}</td>
            <td className={NUMERIC}>{formatSpend(total.spendCents)}</td>
            <td className={NUMERIC}>{formatCount(total.leads)}</td>
            <td className={NUMERIC}>
              {formatCostPerLead(total.costPerLeadCents)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
