import type { Metadata } from 'next';
import { EmptyState, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Ads' };

// Placeholder. Replaced by the ads module build.
export default function AdsPage() {
  return (
    <>
      <PageHeader title="Ads" description="Ad creative, budgets, and performance." />
      <EmptyState
        title="Not built yet"
        description="This module is under construction."
      />
    </>
  );
}
