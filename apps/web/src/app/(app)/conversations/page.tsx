import type { Metadata } from 'next';
import { Inbox } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';

export const metadata: Metadata = { title: 'Inbox' };

/**
 * Placeholder. The schema, types, nav entry and adapters for this module are in
 * place; the module itself is being built. Replace this file wholesale.
 */
export default async function ConversationsPage() {
  await requireUserOrRedirect();

  return (
    <>
      <PageHeader title="Inbox" description="Every conversation, whichever channel it arrived on." />
      <EmptyState
        icon={<Inbox size={22} aria-hidden="true" />}
        title="Not built yet"
        description="This module is under construction."
      />
    </>
  );
}
