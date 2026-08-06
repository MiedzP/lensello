import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { Camera } from 'lucide-react';
import { SHOOT_TYPE_LABELS } from '@lensello/core';
import { createAdminClient } from '@/lib/supabase/admin';
import { listGalleryPhotos, recordView, resolveGallery } from '@/lib/galleries/queries';
import { hashVisitor } from '@/lib/galleries/tokens';
import { unlockCookieName, verifyUnlock } from '@/lib/galleries/unlock';
import { GalleryGrid, GalleryLock } from './gallery-grid';

/**
 * A private gallery must never be indexed, cached by an intermediary, or show
 * up in a referrer sent to another site.
 */
export const metadata: Metadata = {
  title: 'Gallery',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export const dynamic = 'force-dynamic';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">{children}</div>
  );
}

function Closed({ title, body }: { title: string; body: string }) {
  return (
    <Shell>
      <div className="mx-auto max-w-md py-16 text-center">
        <Camera size={26} className="mx-auto text-faint" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted">{body}</p>
      </div>
    </Shell>
  );
}

export default async function GalleryPage(props: PageProps<'/g/[token]'>) {
  const { token } = await props.params;

  const admin = createAdminClient();
  const resolved = await resolveGallery(admin, token);

  // Deliberately the same message for a wrong token and a deleted gallery.
  // Distinguishing them would confirm to somebody guessing tokens that they
  // had found a real one.
  if (!resolved) {
    return (
      <Closed
        title="Gallery not found"
        body="This link doesn't match a gallery. Check you have the whole address, or ask your photographer to send it again."
      />
    );
  }

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

  if (resolved.requiresPassword) {
    const store = await cookies();
    const unlocked = verifyUnlock(
      store.get(unlockCookieName(gallery.id))?.value,
      gallery.id,
      gallery.password_hash!,
    );

    if (!unlocked) {
      return (
        <Shell>
          <GalleryLock token={token} title={gallery.title || shoot.title} />
        </Shell>
      );
    }
  }

  const photos = await listGalleryPhotos(admin, gallery);

  // Recorded so the studio can see the gallery was opened before chasing.
  // Awaited but non-fatal — `recordView` swallows its own failures.
  const headerList = await headers();
  const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim();
  await recordView(admin, gallery.id, ip ? hashVisitor(ip) : null);

  return (
    <Shell>
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
          <p className="mx-auto mt-4 max-w-prose text-sm text-muted">
            {gallery.message}
          </p>
        ) : null}
      </header>

      {photos.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          There are no photographs in this gallery yet.
        </p>
      ) : (
        <GalleryGrid
          token={token}
          photos={photos}
          approved={approval !== null}
          allowDownloads={gallery.allow_downloads}
          watermark={gallery.watermark}
        />
      )}
    </Shell>
  );
}
