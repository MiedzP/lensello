import type { Metadata } from 'next';
import { EmptyState, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Clients' };

// Placeholder. Replaced by the clients module build.
export default function ClientsPage() {
  return (
    <>
      <PageHeader title="Clients" description="Inquiry inbox, reply drafting, and client records." />
      <EmptyState
        title="Not built yet"
        description="This module is under construction."
      />
    </>
  );
}
