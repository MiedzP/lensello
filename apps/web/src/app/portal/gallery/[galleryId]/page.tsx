import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { Camera } from 'lucide-react';
import { SHOOT_TYPE_LABELS } from '@lensello/core';
import { createAdminClient } from '@/lib/supabase/admin';
import { asGalleryLayout } from '@/lib/validators';
import { listGalleryPhotos, resolveGalleryForClient } from '@/lib/galleries/queries';
import { listGallerySections } from '@/lib/galleries/sections';
import { PORTAL_COOKIE_NAME, readPortalSession } from '@/lib/portal/session';
import { PortalGalleryView } from './gallery-view';

export const metadata: Metadata = {
  title: 'Gallery',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export const dynamic = 'force-dynamic';

function Closed({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-md px-6 py-16 text-center">
      <Camera size={26} className="mx-auto text-faint" aria-hidden="true" />
      <h1 className="mt-3 text-lg font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </div>
  );
}

export default async function PortalGalleryPage(props: PageProps<'/portal/gallery/[galleryId]'>) {
  const { galleryId } = await props.params;

  const admin = createAdminClient();
  const store = await cookies();
  const session = await readPortalSession(admin, store.get(PORTAL_COOKIE_NAME)?.value);

  // No session at all — send them to sign in rather than a bare 404, which
  // would read as "this gallery doesn't exist" to somebody who is simply
  // signed out.
  if (!session) redirect('/portal');

  const resolved = await resolveGalleryForClient(admin, galleryId, session.account.client_id);
  if (!resolved) notFound();

  if (resolved.problem === 'revoked') {
    return (
      <Closed
        title="This gallery is closed"
        body="The studio has closed this gallery. Get in touch with them if you still need access."
      />
    );
  }

  if (resolved.problem === 'expired') {
    return (
      <Closed
        title="This link has expired"
        body="Ask your photographer for a fresh link and you'll be straight back in."
      />
    );
  }

  const { gallery, shoot, approval } = resolved;

  const [photos, sections] = await Promise.all([
    listGalleryPhotos(admin, gallery),
    listGallerySections(admin, gallery.id),
  ]);

  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
        <header className="mb-8 text-center">
          <Camera size={24} className="mx-auto text-accent" aria-hidden="true" />
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
            {gallery.title || shoot.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {SHOOT_TYPE_LABELS[shoot.type]}
            {shoot.shot_at
              ? ` · ${new Date(shoot.shot_at).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}`
              : ''}
          </p>

          {gallery.message ? (
            <p className="mx-auto mt-4 max-w-prose text-sm text-muted">{gallery.message}</p>
          ) : null}
        </header>
      </div>

      {photos.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          There are no photographs in this gallery yet.
        </p>
      ) : (
        <div className="pb-10">
          <PortalGalleryView
            galleryId={gallery.id}
            photos={photos}
            sections={sections}
            displayStyle={asGalleryLayout(gallery.display_style)}
            accentColor={gallery.accent_color}
            approved={approval !== null}
            allowDownloads={gallery.allow_downloads}
            watermark={gallery.watermark}
          />
        </div>
      )}
    </>
  );
}
