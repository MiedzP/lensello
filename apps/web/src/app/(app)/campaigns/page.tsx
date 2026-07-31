import type { Metadata } from 'next';
import Link from 'next/link';
import { Megaphone, Plus, Sparkles } from 'lucide-react';
import {
  Badge,
  Card,
  EmptyState,
  ErrorNote,
  PageHeader,
} from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { pluralize } from '@/lib/utils';
import {
  CAMPAIGN_STATUSES,
  CAMPAIGN_OBJECTIVE_LABELS,
  type CampaignObjective,
  type CampaignStatus,
} from '@lensello/core';
import {
  countCampaignsByStatus,
  listCampaignSummaries,
} from '@/lib/campaigns/queries';
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_TONES,
  PLATFORM_LABELS,
  formatDateWindow,
} from '@/lib/campaigns/display';
import { LinkButton } from './components/link-button';

export const metadata: Metadata = { title: 'Campaigns' };

function isCampaignStatus(value: string | undefined): value is CampaignStatus {
  return (
    typeof value === 'string' &&
    (CAMPAIGN_STATUSES as readonly string[]).includes(value)
  );
}

export default async function CampaignsPage(props: PageProps<'/campaigns'>) {
  const { supabase } = await requireUserOrRedirect();

  // A crafted ?status= must not reach the query; anything unrecognised is
  // treated as "no filter" rather than as an error page.
  const raw = (await props.searchParams).status;
  const active = isCampaignStatus(typeof raw === 'string' ? raw : undefined)
    ? (raw as CampaignStatus)
    : undefined;

  let summaries: Awaited<ReturnType<typeof listCampaignSummaries>> = [];
  let counts = { total: 0, byStatus: {} as Record<string, number> };
  let loadError: string | null = null;

  try {
    [summaries, counts] = await Promise.all([
      listCampaignSummaries(supabase, active),
      countCampaignsByStatus(supabase),
    ]);
  } catch {
    loadError = 'Could not load campaigns. Refresh to try again.';
  }

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Plan a set of social posts around one goal, then approve and publish them."
        action={
          <LinkButton href="/campaigns/new" variant="primary">
            <Sparkles size={15} aria-hidden="true" />
            New campaign
          </LinkButton>
        }
      />

      {loadError ? <ErrorNote>{loadError}</ErrorNote> : null}

      {counts.total > 0 ? (
        <nav aria-label="Filter by status" className="mb-4 flex flex-wrap gap-1.5">
          <FilterChip label="All" count={counts.total} isActive={!active} />
          {CAMPAIGN_STATUSES.filter((status) => counts.byStatus[status]).map(
            (status) => (
              <FilterChip
                key={status}
                label={CAMPAIGN_STATUS_LABELS[status]}
                count={counts.byStatus[status] ?? 0}
                status={status}
                isActive={active === status}
              />
            ),
          )}
        </nav>
      ) : null}

      {counts.total === 0 && !loadError ? (
        <EmptyState
          icon={<Megaphone size={26} aria-hidden="true" />}
          title="No campaigns yet"
          description="Describe the goal, the audience, and which platforms you post to. Lensello drafts the whole set of posts — captions, hashtags and all — and you edit from there."
          action={
            <LinkButton href="/campaigns/new" variant="primary">
              <Plus size={15} aria-hidden="true" />
              Create your first campaign
            </LinkButton>
          }
        />
      ) : null}

      {counts.total > 0 && summaries.length === 0 ? (
        <EmptyState
          title={`No ${active ? CAMPAIGN_STATUS_LABELS[active].toLowerCase() : ''} campaigns`}
          description="Nothing matches this filter yet."
          action={<LinkButton href="/campaigns">Show all campaigns</LinkButton>}
        />
      ) : null}

      {summaries.length > 0 ? (
        <Card>
          <ul className="divide-y divide-subtle">
            {summaries.map(({ campaign, postCount, publishedCount }) => (
              <li key={campaign.id}>
                <Link
                  href={`/campaigns/${campaign.id}`}
                  className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-surface-hover sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {campaign.name}
                      </span>
                      <Badge
                        tone={
                          CAMPAIGN_STATUS_TONES[campaign.status as CampaignStatus] ??
                          'neutral'
                        }
                      >
                        {CAMPAIGN_STATUS_LABELS[campaign.status as CampaignStatus] ??
                          campaign.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {CAMPAIGN_OBJECTIVE_LABELS[
                        campaign.objective as CampaignObjective
                      ] ?? campaign.objective}
                      {' · '}
                      {formatDateWindow(campaign.starts_on, campaign.ends_on)}
                    </p>
                    {campaign.platforms.length > 0 ? (
                      <p className="mt-1.5 text-xs text-faint">
                        {campaign.platforms
                          .map(
                            (platform) =>
                              PLATFORM_LABELS[
                                platform as keyof typeof PLATFORM_LABELS
                              ] ?? platform,
                          )
                          .join(' · ')}
                      </p>
                    ) : null}
                  </div>

                  <div className="shrink-0 text-left sm:text-right">
                    <p className="text-sm tabular-nums text-foreground">
                      {pluralize(postCount, 'post')}
                    </p>
                    <p className="text-xs tabular-nums text-muted">
                      {postCount === 0
                        ? 'Nothing drafted'
                        : `${publishedCount} published`}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

function FilterChip({
  label,
  count,
  status,
  isActive,
}: {
  label: string;
  count: number;
  status?: CampaignStatus;
  isActive: boolean;
}) {
  return (
    <Link
      href={status ? { pathname: '/campaigns', query: { status } } : '/campaigns'}
      aria-current={isActive ? 'page' : undefined}
      className={
        isActive
          ? 'rounded-full bg-accent-subtle px-3 py-1 text-xs font-medium text-accent'
          : 'rounded-full border border-subtle px-3 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground'
      }
    >
      {label}
      <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
    </Link>
  );
}
