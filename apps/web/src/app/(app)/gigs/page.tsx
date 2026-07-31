import type { Metadata } from 'next';
import { EmptyState, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Gigs' };

// Placeholder. Replaced by the gigs module build.
export default function GigsPage() {
  return (
    <>
      <PageHeader title="Gigs" description="Booking calendar, shoot logistics, and deposits." />
      <EmptyState
        title="Not built yet"
        description="This module is under construction."
      />
    </>
  );
}
