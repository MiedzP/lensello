import type { Metadata } from 'next';
import { ShoppingBag } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';

export const metadata: Metadata = { title: 'Store' };

/**
 * Placeholder. The schema, types, nav entry and adapters for this module are in
 * place; the module itself is being built. Replace this file wholesale.
 */
export default async function StorePage() {
  await requireUserOrRedirect();

  return (
    <>
      <PageHeader title="Store" description="Print catalogue, client orders and lab fulfilment." />
      <EmptyState
        icon={<ShoppingBag size={22} aria-hidden="true" />}
        title="Not built yet"
        description="This module is under construction."
      />
    </>
  );
}
