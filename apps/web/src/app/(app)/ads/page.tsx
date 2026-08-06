import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Target, Wand2 } from 'lucide-react';
import { Card, EmptyState, ErrorNote, PageHeader, Stat } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { listAdsWithPerformance, summarizeAll } from '@/lib/ads/queries';
import { hasActiveFilters, parseAdFilters } from '@/lib/ads/schema';
import {
  formatCostPerLead,
  formatCount,
  formatCtr,
  formatSpend,
} from '@/lib/ads/format';
import { AdFilters } from './components/ad-filters';
import { AdsTable } from './components/ads-table';
import { LinkButton } from './components/link-button';
import { SyncForm } from './components/sync-form';

export const metadata: Metadata = { title: 'Ads' };

export default async function AdsPage(props: PageProps<'/ads'>) {
  const { supabase } = await requireUserOrRedirect();

  // Promise in Next 16 — synchronous access was removed.
  const filters = parseAdFilters(await props.searchParams);
  const { rows, error } = await listAdsWithPerformance(supabase, filters);

  const totals = summarizeAll(rows);
  const isFiltered = hasActiveFilters(filters);

  return (
    <>
      <PageHeader
        title="Ads"
        description="Ad creative, budgets, and performance."
        action={
          <div className="flex gap-2">
            <LinkButton href="/ads/creative">
              <Wand2 size={16} aria-hidden="true" />
              Ad creative
            </LinkButton>
            <LinkButton href="/ads/new" variant="primary">
              <Plus size={16} aria-hidden="true" />
              New ad
            </LinkButton>
          </div>
        }
      />

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {rows.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <Stat
              label="Spend"
              value={formatSpend(totals.spendCents)}
              hint={isFiltered ? 'Across the filtered ads' : 'Across all ads'}
            />
          </Card>
          <Card>
            <Stat
              label="Click-through rate"
              value={formatCtr(totals.ctr, totals.impressions)}
              hint={`${formatCount(totals.clicks)} of ${formatCount(totals.impressions)} impressions`}
            />
          </Card>
          <Card>
            <Stat label="Leads" value={formatCount(totals.leads)} />
          </Card>
          <Card>
            <Stat
              label="Cost per lead"
              value={formatCostPerLead(totals.costPerLeadCents)}
              hint={
                totals.costPerLeadCents === null
                  ? 'No leads attributed yet'
                  : undefined
              }
            />
          </Card>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <AdFilters filters={filters} />
        <SyncForm label="Sync all" />
      </div>

      <Card className="mt-4">
        {rows.length > 0 ? (
          <AdsTable rows={rows} />
        ) : isFiltered ? (
          <EmptyState
            className="border-0"
            icon={<Target size={22} aria-hidden="true" />}
            title="No ads match these filters"
            description="Nothing is running under that combination of status and platform."
            action={
              <Link href="/ads" className="text-sm text-accent hover:underline">
                Clear filters
              </Link>
            }
          />
        ) : (
          <EmptyState
            className="border-0"
            icon={<Target size={22} aria-hidden="true" />}
            title="No ads yet"
            description="Build an ad from a photo in the library, generate a few copy angles to test, then launch it to a platform."
            action={
              <LinkButton href="/ads/new" variant="primary">
                <Plus size={16} aria-hidden="true" />
                New ad
              </LinkButton>
            }
          />
        )}
      </Card>
    </>
  );
}
