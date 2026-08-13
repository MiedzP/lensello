import type { Metadata } from 'next';
import { Bot } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';

export const metadata: Metadata = { title: 'Automations' };

/**
 * Placeholder. The schema, types, nav entry and adapters for this module are in
 * place; the module itself is being built. Replace this file wholesale.
 */
export default async function AutomationsPage() {
  await requireUserOrRedirect();

  return (
    <>
      <PageHeader title="Automations" description="Trigger-and-step workflows, plus the API keys that drive them." />
      <EmptyState
        icon={<Bot size={22} aria-hidden="true" />}
        title="Not built yet"
        description="This module is under construction."
      />
    </>
  );
}
