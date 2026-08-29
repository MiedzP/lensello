import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { asGalleryLayout } from '@/lib/validators';
import { getGalleryForStaff, signAssetThumbnails } from '@/lib/galleries/queries';
import { listGallerySections } from '@/lib/galleries/sections';
import { listClientOptions } from '@/lib/library/queries';
import { PresentationPanel } from './components/presentation-panel';
import { SectionsPanel } from './components/sections-panel';
import { ClientPortalPanel } from './components/client-portal-panel';

export const metadata: Metadata = { title: 'Gallery presentation' };

/** Thumbnails are only for the cover picker's visual strip, so a generous but bounded slice is enough. */
const COVER_PICKER_LIMIT = 80;

export default async function GalleryAdminPage(props: PageProps<'/galleries/[galleryId]'>) {
  const [{ supabase }, { galleryId }] = await Promise.all([requireUserOrRedirect(), props.params]);

  const detail = await getGalleryForStaff(supabase, galleryId);
  if (!detail) notFound();

  const coverCandidates = detail.assets.slice(0, COVER_PICKER_LIMIT);

  const [sections, clients, thumbUrls] = await Promise.all([
    listGallerySections(supabase, galleryId),
    listClientOptions(supabase),
    signAssetThumbnails(
      supabase,
      coverCandidates.map((asset) => asset.storage_path),
    ),
  ]);

  const coverThumbs = coverCandidates.map((asset) => ({
    id: asset.id,
    filename: asset.filename,
    thumbUrl: thumbUrls.get(asset.storage_path) ?? null,
  }));

  const assetOptions = detail.assets.map((asset) => ({ id: asset.id, filename: asset.filename }));

  return (
    <>
      <PageHeader
        title={detail.gallery.title || detail.shoot.title}
        description={`Presentation, sections and portal access for ${detail.shoot.title}.`}
      />

      <div className="space-y-6">
        <PresentationPanel
          galleryId={detail.gallery.id}
          displayStyle={asGalleryLayout(detail.gallery.display_style)}
          accentColor={detail.gallery.accent_color}
          coverAssetId={detail.gallery.cover_asset_id}
          assets={coverThumbs}
        />

        <SectionsPanel
          galleryId={detail.gallery.id}
          sections={sections.map((section) => ({
            id: section.id,
            title: section.title,
            blurb: section.blurb,
            assetIds: section.assetIds,
          }))}
          assets={assetOptions}
        />

        <ClientPortalPanel
          galleryId={detail.gallery.id}
          clientId={detail.gallery.client_id}
          clientEmail={detail.client?.email ?? null}
          clients={clients}
          portalAccount={
            detail.portalAccount
              ? {
                  id: detail.portalAccount.id,
                  email: detail.portalAccount.email,
                  hasPasscode: detail.portalAccount.passcode_hash !== null,
                  revokedAt: detail.portalAccount.revoked_at,
                  lastSeenAt: detail.portalAccount.last_seen_at,
                }
              : null
          }
        />
      </div>
    </>
  );
}
