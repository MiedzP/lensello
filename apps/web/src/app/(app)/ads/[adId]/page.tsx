import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LineChart } from 'lucide-react';
import { formatCents, summarize } from '@lensello/core';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Stat,
} from '@/components/ui';
import { isAiConfigured } from '@/lib/ai';
import { requireUserOrRedirect } from '@/lib/auth';
import {
  AD_PLATFORM_LABELS,
  AD_STATUS_LABELS,
  AD_STATUS_TONES,
} from '@/lib/ads/constants';
import {
  formatCostPerLead,
  formatCount,
  formatCtr,
  formatDateWindow,
  formatSpend,
} from '@/lib/ads/format';
import {
  getAd,
  getAdCreative,
  listAdMetrics,
  listCampaignOptions,
  listCreativeChoices,
  listShootTypesInUse,
} from '@/lib/ads/queries';
import { AdForm, type AdFormValues } from '../components/ad-form';
import { AdPreview } from '../components/ad-preview';
import { DailyChart } from '../components/daily-chart';
import { DailyTable } from '../components/daily-table';
import { StatusControls } from '../components/status-controls';
import { SyncForm } from '../components/sync-form';

export const metadata: Metadata = { title: 'Ad' };

export default async function AdDetailPage(props: PageProps<'/ads/[adId]'>) {
  const { supabase } = await requireUserOrRedirect();

  // `params` is a Promise in Next 16.
  const { adId } = await props.params;

  const ad = await getAd(supabase, adId);
  if (!ad) notFound();

  const [metrics, creative, campaigns, creatives, shootTypesInUse] =
    await Promise.all([
      listAdMetrics(supabase, ad.id),
      getAdCreative(supabase, ad.asset_id),
      listCampaignOptions(supabase),
      listCreativeChoices(supabase, { includeAssetId: ad.asset_id }),
      listShootTypesInUse(supabase),
    ]);

  const performance = summarize(metrics, ad.id);

  const initial: AdFormValues = {
    id: ad.id,
    name: ad.name,
    platform: ad.platform,
    headline: ad.headline,
    primaryText: ad.primary_text,
    callToAction: ad.call_to_action,
    dailyBudgetCents: ad.daily_budget_cents,
    audience: ad.audience ?? '',
    assetId: ad.asset_id ?? '',
    campaignId: ad.campaign_id ?? '',
    startsOn: ad.starts_on ?? '',
    endsOn: ad.ends_on ?? '',
  };

  return (
    <>
      <PageHeader
        title={ad.name}
        description={
          <>
            {AD_PLATFORM_LABELS[ad.platform]} ·{' '}
            {formatCents(ad.daily_budget_cents)}/day ·{' '}
            {formatDateWindow(ad.starts_on, ad.ends_on)} ·{' '}
            <Link href="/ads" className="text-accent hover:underline">
              All ads
            </Link>
          </>
        }
        action={
          <Badge tone={AD_STATUS_TONES[ad.status]}>
            {AD_STATUS_LABELS[ad.status]}
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <Stat
            label="Spend"
            value={formatSpend(performance.spendCents)}
            hint={`${metrics.length} ${metrics.length === 1 ? 'day' : 'days'} recorded`}
          />
        </Card>
        <Card>
          <Stat
            label="Click-through rate"
            value={formatCtr(performance.ctr, performance.impressions)}
            hint={`${formatCount(performance.clicks)} of ${formatCount(performance.impressions)} impressions`}
          />
        </Card>
        <Card>
          <Stat label="Leads" value={formatCount(performance.leads)} />
        </Card>
        <Card>
          <Stat
            label="Cost per lead"
            value={formatCostPerLead(performance.costPerLeadCents)}
            hint={
              performance.costPerLeadCents === null
                ? 'No leads attributed yet'
                : undefined
            }
          />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader
            title="Performance over time"
            description="Pulled from the ad platform through the ads adapter. Re-syncing an overlapping window updates those days rather than duplicating them."
            action={<SyncForm adId={ad.id} label="Sync" />}
          />
          <CardBody className="space-y-6">
            {metrics.length > 0 ? (
              <>
                <div className="grid gap-6 sm:grid-cols-2">
                  <DailyChart
                    metrics={metrics}
                    label="Spend"
                    pick={(metric) => metric.spendCents}
                    format={(value) => formatCents(value)}
                  />
                  <DailyChart
                    metrics={metrics}
                    label="Clicks"
                    pick={(metric) => metric.clicks}
                    format={(value) => formatCount(value)}
                  />
                </div>
                <DailyTable metrics={metrics} adId={ad.id} />
              </>
            ) : (
              <EmptyState
                className="border-0"
                icon={<LineChart size={22} aria-hidden="true" />}
                title="No performance data yet"
                description={
                  ad.external_id
                    ? 'Sync performance to pull daily numbers from the platform.'
                    : 'This ad has not been launched to a platform, so there is nothing to report on yet.'
                }
              />
            )}
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Status" />
            <CardBody>
              <StatusControls
                adId={ad.id}
                status={ad.status}
                externalId={ad.external_id}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Preview"
              description="Roughly how the placement will read."
            />
            <CardBody>
              <AdPreview
                platform={ad.platform}
                headline={ad.headline}
                primaryText={ad.primary_text}
                callToAction={ad.call_to_action}
                creative={creative}
              />
            </CardBody>
          </Card>
        </div>
      </div>

      <h2 className="mt-8 mb-4 text-sm font-semibold text-foreground">
        Edit this ad
      </h2>

      <AdForm
        mode="edit"
        initial={initial}
        campaigns={campaigns}
        creatives={creatives}
        shootTypesInUse={shootTypesInUse}
        aiEnabled={isAiConfigured()}
      />
    </>
  );
}
