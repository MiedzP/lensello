import Link from 'next/link';
import { Radio } from 'lucide-react';
import { Badge, Card } from '@/components/ui';
import { CAMPAIGN_OBJECTIVE_LABELS, type CampaignObjective } from '@lensello/core';
import { cn } from '@/lib/utils';
import type { Tables } from '@/lib/db.types';
import { calendarHref } from '@/lib/planner/calendar-grid';

/**
 * "You can click on it and see that we're running this at the moment."
 *
 * A campaign is "running now" when it is active or scheduled and today falls
 * inside its window (an unset start or end date does not disqualify it — an
 * open-ended campaign is still running). Clicking one filters the grid below
 * to that campaign, so the tasks and posts it produced are the only thing
 * left highlighted.
 */
export function RunningNow({
  campaigns,
  activeCampaignId,
}: {
  campaigns: Tables<'campaigns'>[];
  activeCampaignId: string | null;
}) {
  return (
    <Card className="mb-5 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-subtle px-4 py-2.5">
        <Radio size={13} className="text-accent" aria-hidden="true" />
        <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
          Running now
        </h2>
      </div>
      <ul className="flex flex-wrap gap-2 p-3">
        {campaigns.map((campaign) => {
          const isActive = campaign.id === activeCampaignId;
          return (
            <li key={campaign.id}>
              <Link
                href={
                  isActive
                    ? calendarHref({})
                    : calendarHref({ campaignId: campaign.id })
                }
                className={cn(
                  'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  isActive
                    ? 'border-accent bg-accent-subtle text-accent'
                    : 'border-subtle bg-surface text-foreground hover:bg-surface-hover',
                )}
              >
                {campaign.name}
                <Badge tone="neutral">
                  {CAMPAIGN_OBJECTIVE_LABELS[campaign.objective as CampaignObjective] ??
                    campaign.objective}
                </Badge>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
