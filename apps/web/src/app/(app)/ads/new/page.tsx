import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/ui';
import { isAiConfigured } from '@/lib/ai';
import { requireUserOrRedirect } from '@/lib/auth';
import {
  listCampaignOptions,
  listCreativeChoices,
  listShootTypesInUse,
} from '@/lib/ads/queries';
import { AdForm, BLANK_AD } from '../components/ad-form';

export const metadata: Metadata = { title: 'New ad' };

export default async function NewAdPage() {
  const { supabase } = await requireUserOrRedirect();

  // Independent reads — the page waits on the slowest, not the sum. The
  // creative list is the expensive one because it also signs URLs.
  const [campaigns, creatives, shootTypesInUse] = await Promise.all([
    listCampaignOptions(supabase),
    listCreativeChoices(supabase),
    listShootTypesInUse(supabase),
  ]);

  return (
    <>
      <PageHeader
        title="New ad"
        description={
          <>
            Saved as a draft. Launching it to a platform happens from the ad&rsquo;s
            own page, once the creative is complete.{' '}
            <Link href="/ads" className="text-accent hover:underline">
              Back to ads
            </Link>
          </>
        }
      />

      <AdForm
        mode="create"
        initial={BLANK_AD}
        campaigns={campaigns}
        creatives={creatives}
        shootTypesInUse={shootTypesInUse}
        aiEnabled={isAiConfigured()}
      />
    </>
  );
}
