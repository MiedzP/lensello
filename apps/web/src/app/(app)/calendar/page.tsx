import type { Metadata } from 'next';
import { CalendarDays } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';

export const metadata: Metadata = { title: 'Calendar' };

/**
 * Placeholder. The schema, types, nav entry and adapters for this module are in
 * place; the module itself is being built. Replace this file wholesale.
 */
export default async function CalendarPage() {
  await requireUserOrRedirect();

  return (
    <>
      <PageHeader title="Calendar" description="Everything dated in one place: shoots, scheduled posts and campaign tasks." />
      <EmptyState
        icon={<CalendarDays size={22} aria-hidden="true" />}
        title="Not built yet"
        description="This module is under construction."
      />
    </>
  );
}
