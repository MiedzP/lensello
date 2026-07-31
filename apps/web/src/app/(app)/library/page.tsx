import type { Metadata } from 'next';
import { EmptyState, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Library' };

// Placeholder. Replaced by the library module build.
export default function LibraryPage() {
  return (
    <>
      <PageHeader title="Library" description="Shoots, photo assets, selects, and tagging." />
      <EmptyState
        title="Not built yet"
        description="This module is under construction."
      />
    </>
  );
}
