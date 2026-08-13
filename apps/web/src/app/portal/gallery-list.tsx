import Image from 'next/image';
import Link from 'next/link';
import { Camera, Lock } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import type { PortalGalleryCard } from '@/lib/portal/queries';
import { PortalSignOutButton } from './sign-out-button';

export function PortalDashboard({
  clientName,
  galleries,
}: {
  clientName: string;
  galleries: PortalGalleryCard[];
}) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Welcome back</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{clientName}</h1>
        </div>
        <PortalSignOutButton />
      </header>

      {galleries.length === 0 ? (
        <EmptyState
          icon={<Camera size={22} aria-hidden="true" />}
          title="No galleries yet"
          description="Once your photographer shares a gallery with you, it will show up here."
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {galleries.map((gallery) => (
            <GalleryCard key={gallery.id} gallery={gallery} />
          ))}
        </div>
      )}
    </div>
  );
}

function GalleryCard({ gallery }: { gallery: PortalGalleryCard }) {
  const shotAt = gallery.shotAt
    ? new Date(gallery.shotAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const body = (
    <>
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-surface-raised">
        {gallery.coverUrl ? (
          <Image
            src={gallery.coverUrl}
            alt={gallery.title}
            fill
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-faint">
            <Camera size={22} aria-hidden="true" />
          </div>
        )}

        {gallery.isClosed ? (
          <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/50 text-xs font-medium text-white">
            <Lock size={12} aria-hidden="true" />
            Closed
          </div>
        ) : null}
      </div>

      <div className="mt-3">
        <p className="text-sm font-medium text-foreground">{gallery.title}</p>
        <p className="mt-0.5 text-xs text-muted">
          {shotAt ?? gallery.shootTitle}
          {gallery.isApproved ? ' · Approved' : ''}
        </p>
      </div>
    </>
  );

  if (gallery.isClosed) {
    return <div className="group cursor-default opacity-70">{body}</div>;
  }

  return (
    <Link href={`/portal/gallery/${gallery.id}`} className="group block">
      {body}
    </Link>
  );
}
