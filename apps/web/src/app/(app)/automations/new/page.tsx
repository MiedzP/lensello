import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { CreateAutomationForm } from '../components/create-automation-form';

export const metadata: Metadata = { title: 'New automation' };

export default async function NewAutomationPage() {
  await requireUserOrRedirect();

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
        title="New automation"
        description="Pick what starts it. You'll add steps and switch it on next."
      />

      <CreateAutomationForm />
    </>
  );
}
