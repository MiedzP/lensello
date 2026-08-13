import type { Metadata } from 'next';
import { GraduationCap } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';

export const metadata: Metadata = { title: 'Academy' };

/**
 * Placeholder. The schema, types, nav entry and adapters for this module are in
 * place; the module itself is being built. Replace this file wholesale.
 */
export default async function AcademyPage() {
  await requireUserOrRedirect();

  return (
    <>
      <PageHeader title="Academy" description="Marketing training, worksheets, and what Lensello knows about the business." />
      <EmptyState
        icon={<GraduationCap size={22} aria-hidden="true" />}
        title="Not built yet"
        description="This module is under construction."
      />
    </>
  );
}
