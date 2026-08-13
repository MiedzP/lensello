import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { listApiKeys } from '@/lib/automations/queries';
import { ApiKeyList } from '../components/api-key-list';
import { CreateKeyForm } from '../components/create-key-form';

export const metadata: Metadata = { title: 'API keys' };

export default async function ApiKeysPage() {
  const { supabase } = await requireUserOrRedirect();
  const keys = await listApiKeys(supabase);

  return (
    <>
      <Link
        href="/automations"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ChevronLeft size={15} aria-hidden="true" />
        Automations
      </Link>

      <PageHeader
        title="API keys"
        description="Authenticate calls to /api/v1 — listing automations, triggering a webhook automation, and reading its run history."
      />

      <div className="space-y-5">
        <CreateKeyForm />
        <ApiKeyList keys={keys} />
      </div>
    </>
  );
}
