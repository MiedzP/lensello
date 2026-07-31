import Link from 'next/link';
import { Badge } from '@/components/ui';
import {
  AD_PLATFORM_LABELS,
  AD_STATUS_LABELS,
  AD_STATUS_TONES,
} from '@/lib/ads/constants';
import {
  formatCostPerLead,
  formatCount,
  formatCtr,
  formatSpend,
} from '@/lib/ads/format';
import type { AdWithPerformance } from '@/lib/ads/queries';
import { formatCents } from '@lensello/core';

/**
 * The ads list with its performance roll-up.
 *
 * Every numeric cell carries `tabular-nums`. In a proportional face the digits
 * have different widths, so a column of numbers shifts sideways as values
 * change — which is exactly what a table someone is scanning for outliers must
 * not do.
 */

const NUMERIC = 'px-3 py-3 text-right text-sm tabular-nums whitespace-nowrap';
const NUMERIC_HEAD = 'px-3 py-2 text-right font-medium whitespace-nowrap';

export function AdsTable({ rows }: { rows: readonly AdWithPerformance[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] border-collapse text-left">
        <caption className="sr-only">
          Ads with lifetime performance. Cost per lead shows an em dash for ads
          that have not produced a lead yet.
        </caption>
        <thead>
          <tr className="border-b border-subtle text-xs text-muted">
            <th scope="col" className="px-3 py-2 font-medium">
              Ad
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Platform
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Status
            </th>
            <th scope="col" className={NUMERIC_HEAD}>
              Daily budget
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
          {rows.map(({ ad, performance }) => (
            <tr key={ad.id} className="hover:bg-surface-hover">
              <th scope="row" className="max-w-[16rem] px-3 py-3 font-normal">
                <Link
                  href={`/ads/${ad.id}`}
                  className="block truncate text-sm font-medium text-foreground hover:text-accent hover:underline"
                >
                  {ad.name}
                </Link>
                {ad.headline ? (
                  <span className="block truncate text-xs text-muted">
                    {ad.headline}
                  </span>
                ) : (
                  <span className="block text-xs text-faint">No headline yet</span>
                )}
              </th>
              <td className="px-3 py-3 text-sm text-muted whitespace-nowrap">
                {AD_PLATFORM_LABELS[ad.platform]}
              </td>
              <td className="px-3 py-3">
                <Badge tone={AD_STATUS_TONES[ad.status]}>
                  {AD_STATUS_LABELS[ad.status]}
                </Badge>
              </td>
              <td className={NUMERIC}>{formatCents(ad.daily_budget_cents)}</td>
              <td className={NUMERIC}>{formatCount(performance.impressions)}</td>
              <td className={NUMERIC}>{formatCount(performance.clicks)}</td>
              <td className={NUMERIC}>
                {formatCtr(performance.ctr, performance.impressions)}
              </td>
              <td className={NUMERIC}>{formatSpend(performance.spendCents)}</td>
              <td className={NUMERIC}>{formatCount(performance.leads)}</td>
              <td className={NUMERIC}>
                {formatCostPerLead(performance.costPerLeadCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
