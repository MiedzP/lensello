'use client';

import { useActionState, useOptimistic, useTransition } from 'react';
import Image from 'next/image';
import { Heart } from 'lucide-react';
import { Button, ErrorNote, Input } from '@/components/ui';
import type { GalleryPhoto } from '@/lib/galleries/queries';
import {
  GALLERY_IDLE,
  approveSelection,
  toggleFavourite,
  unlockGallery,
} from './actions';

/**
 * Favouriting is optimistic.
 *
 * A heart that waits for a server round trip before filling in feels broken
 * when you are working through two hundred photographs, and that is exactly
 * the moment this screen has to feel good — it is the client's only experience
 * of the studio's software.
 */
export function GalleryGrid({
  token,
  photos,
  approved,
  allowDownloads,
  watermark,
}: {
  token: string;
  photos: GalleryPhoto[];
  approved: boolean;
  allowDownloads: boolean;
  watermark: boolean;
}) {
  const [, favouriteAction] = useActionState(toggleFavourite, GALLERY_IDLE);
  const [, startTransition] = useTransition();

  const [optimistic, setOptimistic] = useOptimistic(
    photos,
    (current, assetId: string) =>
      current.map((photo) =>
        photo.id === assetId ? { ...photo, isFavourite: !photo.isFavourite } : photo,
      ),
  );

  const chosen = optimistic.filter((photo) => photo.isFavourite);

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {optimistic.map((photo) => (
          <figure key={photo.id} className="group relative">
            <div className="relative aspect-square overflow-hidden rounded-md bg-surface-raised">
              <Image
                src={photo.url}
                alt={photo.altText ?? photo.filename}
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                className="object-cover"
              />

              {watermark ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 flex items-center justify-center"
                >
                  <span className="rotate-[-20deg] text-lg font-semibold tracking-widest text-white/35">
                    PROOF
                  </span>
                </div>
              ) : null}
            </div>

            {approved ? null : (
              <form
                action={favouriteAction}
                className="absolute right-2 top-2"
                onSubmit={() => startTransition(() => setOptimistic(photo.id))}
              >
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="assetId" value={photo.id} />
                <button
                  type="submit"
                  aria-pressed={photo.isFavourite}
                  aria-label={
                    photo.isFavourite
                      ? `Remove ${photo.filename} from your picks`
                      : `Add ${photo.filename} to your picks`
                  }
                  className="rounded-full bg-black/45 p-2 text-white backdrop-blur transition-colors hover:bg-black/65"
                >
                  <Heart
                    size={16}
                    aria-hidden="true"
                    className={photo.isFavourite ? 'fill-current' : undefined}
                  />
                </button>
              </form>
            )}

            {allowDownloads ? (
              <a
                href={photo.url}
                download={photo.filename}
                className="absolute bottom-2 left-2 rounded-md bg-black/45 px-2 py-1 text-xs text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                Download
              </a>
            ) : null}
          </figure>
        ))}
      </div>

      <ApprovalBar token={token} chosen={chosen.length} approved={approved} />
    </>
  );
}

function ApprovalBar({
  token,
  chosen,
  approved,
}: {
  token: string;
  chosen: number;
  approved: boolean;
}) {
  const [state, action, pending] = useActionState(approveSelection, GALLERY_IDLE);

  if (approved) {
    return (
      <div
        role="status"
        className="sticky bottom-4 mt-6 rounded-lg border border-success/30 bg-success-subtle px-4 py-3 text-center text-sm text-success"
      >
        Your selection has been sent to the studio. Get in touch if you need to
        change it.
      </div>
    );
  }

  return (
    <div className="sticky bottom-4 mt-6 rounded-lg border border-strong bg-surface/95 p-4 backdrop-blur">
      <p className="text-sm text-foreground">
        <span className="font-medium">{chosen}</span>{' '}
        {chosen === 1 ? 'photograph' : 'photographs'} chosen
      </p>

      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      {state.message ? (
        <p role="status" className="mt-2 text-sm text-success">
          {state.message}
        </p>
      ) : null}

      {chosen > 0 ? (
        <form action={action} className="mt-3 space-y-3">
          <input type="hidden" name="token" value={token} />

          <div className="grid gap-3 sm:grid-cols-2">
            <Input name="approvedName" placeholder="Your name" autoComplete="name" />
            <Input name="note" placeholder="Anything to tell the studio? (optional)" />
          </div>

          <p className="text-xs text-muted">
            Approving sends these picks to the studio and locks the selection.
          </p>

          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Sending…' : `Approve ${chosen} ${chosen === 1 ? 'photograph' : 'photographs'}`}
          </Button>
        </form>
      ) : (
        <p className="mt-1 text-xs text-muted">
          Tap the heart on the ones you want. You can approve when you&rsquo;re
          happy with the set.
        </p>
      )}
    </div>
  );
}

/** Password gate, shown before anything else when a gallery has one. */
export function GalleryLock({ token, title }: { token: string; title: string }) {
  const [state, action, pending] = useActionState(unlockGallery, GALLERY_IDLE);

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-center text-lg font-semibold tracking-tight text-foreground">
        {title || 'Private gallery'}
      </h1>
      <p className="mt-2 text-center text-sm text-muted">
        Enter the password your photographer gave you.
      </p>

      <form action={action} className="mt-6 space-y-3">
        <input type="hidden" name="token" value={token} />

        {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}

        <Input
          name="password"
          type="password"
          autoComplete="off"
          aria-label="Gallery password"
          required
          autoFocus
        />

        <Button type="submit" variant="primary" className="w-full" disabled={pending}>
          {pending ? 'Checking…' : 'Open gallery'}
        </Button>
      </form>
    </div>
  );
}
