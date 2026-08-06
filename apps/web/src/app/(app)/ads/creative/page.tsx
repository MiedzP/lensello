import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { listLibraryPhotos } from '@/lib/campaigns/queries';
import { CreativeStudio, type PickerPhoto } from './creative-studio';

export const metadata: Metadata = { title: 'Ad creative' };

export default async function AdCreativePage() {
  const { supabase } = await requireUserOrRedirect();

  // Reuses the campaigns chooser: it already surfaces selects and highly-rated
  // frames first, which is the same thing wanted here — the strongest work,
  // not the whole library.
  const shoots = await listLibraryPhotos(supabase, { shootLimit: 10, perShoot: 12 });

  const photos: PickerPhoto[] = shoots.flatMap((shoot) =>
    shoot.photos.flatMap((photo) =>
      // A photo whose signed URL could not be minted is omitted rather than
      // rendered as a broken thumbnail nobody can pick.
      photo.url ? [{ id: photo.assetId, url: photo.url, shootTitle: shoot.title }] : [],
    ),
  );

  return (
    <>
      <Link
        href="/ads"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ChevronLeft size={15} aria-hidden="true" />
        Ads
      </Link>

      <PageHeader
        title="Ad creative"
        description="Build an ad from your own photographs — headline, call to action and branding laid over the work, sized for each placement."
      />

      <CreativeStudio
        photos={photos}
        defaultStudioName={process.env.LENSELLO_STUDIO_NAME?.trim() || 'Lensello Photography'}
      />
    </>
  );
}
