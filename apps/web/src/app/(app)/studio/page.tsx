import type { Metadata } from 'next';
import { Sparkles } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';

export const metadata: Metadata = { title: 'Studio' };

/**
 * Placeholder. The schema, types, nav entry and adapters for this module are in
 * place; the module itself is being built. Replace this file wholesale.
 */
export default async function StudioPage() {
  await requireUserOrRedirect();

  return (
    <>
      <PageHeader title="Studio" description="Describe a post in plain English and Lensello finds the photographs for it." />
      <EmptyState
        icon={<Sparkles size={22} aria-hidden="true" />}
        title="Not built yet"
        description="This module is under construction."
      />
    </>
  );
}
