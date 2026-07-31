import type { Metadata } from 'next';
import { EmptyState, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Campaigns' };

// Placeholder. Replaced by the campaigns module build.
export default function CampaignsPage() {
  return (
    <>
      <PageHeader title="Campaigns" description="AI-generated marketing campaigns and social post sets." />
      <EmptyState
        title="Not built yet"
        description="This module is under construction."
      />
    </>
  );
}
