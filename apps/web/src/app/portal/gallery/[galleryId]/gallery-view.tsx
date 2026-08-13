'use client';

/**
 * The portal's gallery viewer. A near-twin of `/g/[token]`'s `GalleryGrid` —
 * same favouriting, approval and style-switching behaviour — but every form
 * carries a `galleryId` instead of a token, and downloads are routed through
 * this route's own download endpoint rather than the token-gated one.
 */

import { useActionState, useMemo, useOptimistic, useState, useTransition } from 'react';
import { Heart } from 'lucide-react';
import { Button, ErrorNote, Input } from '@/components/ui';
import type { DisplayStyle, GalleryPhoto } from '@/lib/galleries/queries';
import { buildDisplaySections, type GallerySectionWithAssets } from '@/lib/galleries/sections';
import { GalleryDisplay } from '@/app/g/[token]/styles';
import { isImmersiveStyle, StyleSwitcher } from '@/app/g/[token]/styles/style-switcher';
import { approveSelectionPortal, toggleFavouritePortal } from './actions';
import { PORTAL_GALLERY_IDLE } from './gallery-state';

export function PortalGalleryView({
  galleryId,
  photos,
  sections,
  displayStyle,
  accentColor,
  approved,
  allowDownloads,
  watermark,
}: {
  galleryId: string;
  photos: GalleryPhoto[];
  sections: GallerySectionWithAssets[];
  displayStyle: DisplayStyle;
  accentColor: string | null;
  approved: boolean;
  allowDownloads: boolean;
  watermark: boolean;
}) {
  const [favouriteState, favouriteAction] = useActionState(toggleFavouritePortal, PORTAL_GALLERY_IDLE);
  const [, startTransition] = useTransition();
  const [style, setStyle] = useState<DisplayStyle>(displayStyle);

  const [optimistic, setOptimistic] = useOptimistic(
    photos,
    (current, assetId: string) =>
      current.map((photo) =>
        photo.id === assetId ? { ...photo, isFavourite: !photo.isFavourite } : photo,
      ),
  );

  const chosen = optimistic.filter((photo) => photo.isFavourite);

  const displaySections = useMemo(
    () => buildDisplaySections(optimistic, sections),
    [optimistic, sections],
  );

  const renderOverlay = (photo: GalleryPhoto) => (
    <div className="flex items-center gap-1.5">
      {approved ? null : (
        <form action={favouriteAction} onSubmit={() => startTransition(() => setOptimistic(photo.id))}>
          <input type="hidden" name="galleryId" value={galleryId} />
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
            <Heart size={16} aria-hidden="true" className={photo.isFavourite ? 'fill-current' : undefined} />
          </button>
        </form>
      )}

      {allowDownloads ? (
        <a
          href={`/portal/gallery/${galleryId}/download/${photo.id}`}
          className="rounded-md bg-black/45 px-2 py-1 text-xs text-white backdrop-blur transition-colors hover:bg-black/65"
        >
          Download
        </a>
      ) : null}
    </div>
  );

  const immersive = isImmersiveStyle(style);

  return (
    <div className={immersive ? 'w-full' : 'mx-auto w-full max-w-6xl px-4 sm:px-6'}>
      <StyleSwitcher style={style} onChange={setStyle} />

      {favouriteState.error ? (
        <div className="mb-4">
          <ErrorNote>{favouriteState.error}</ErrorNote>
        </div>
      ) : null}

      <GalleryDisplay
        style={style}
        photos={optimistic}
        sections={displaySections}
        accentColor={accentColor}
        watermark={watermark}
        renderOverlay={renderOverlay}
      />

      <div className={immersive ? 'mx-auto w-full max-w-2xl px-4 sm:px-6' : undefined}>
        <ApprovalBar galleryId={galleryId} chosen={chosen.length} approved={approved} />
      </div>
    </div>
  );
}

function ApprovalBar({
  galleryId,
  chosen,
  approved,
}: {
  galleryId: string;
  chosen: number;
  approved: boolean;
}) {
  const [state, action, pending] = useActionState(approveSelectionPortal, PORTAL_GALLERY_IDLE);

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
          <input type="hidden" name="galleryId" value={galleryId} />

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
