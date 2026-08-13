import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { isAiConfigured } from '@/lib/ai';
import { listPlatformLinks } from '@/lib/connections/queries';
import { listPlaybooks } from '@/lib/planner/queries';
import { CreateCampaignForm } from '../components/create-campaign-form';

export const metadata: Metadata = { title: 'New campaign' };

export default async function NewCampaignPage() {
  const { supabase } = await requireUserOrRedirect();

  // Resolved on the server: the client must never see whether a key exists,
  // only whether the button is offered.
  const aiConfigured = isAiConfigured();
  const [links, playbooks] = await Promise.all([
    listPlatformLinks(supabase),
    listPlaybooks(supabase),
  ]);

  return (
    <>
      <Link
        href="/campaigns"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ChevronLeft size={15} aria-hidden="true" />
        Campaigns
      </Link>

      <PageHeader
        title="New campaign"
        description={
          aiConfigured
            ? 'Describe the goal and the work you want featured. Lensello drafts one post per platform slot, in the studio voice.'
            : 'Set the goal, audience, and platforms. You will write the posts yourself on the next screen.'
        }
      />

      <CreateCampaignForm aiConfigured={aiConfigured} links={links} playbooks={playbooks} />
    </>
  );
}
