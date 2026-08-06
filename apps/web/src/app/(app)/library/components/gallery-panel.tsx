'use client';

import { useActionState, useState } from 'react';
import { Check, Copy, Eye, Heart, Link2, Lock, X } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorNote,
  Field,
  Input,
  Textarea,
} from '@/components/ui';
import {
  GALLERY_ADMIN_IDLE,
  applyFavouritesAsSelects,
  createGallery,
  revokeGallery,
} from '../gallery-actions';

export interface GalleryRowView {
  id: string;
  title: string;
  hasPassword: boolean;
  expiresAt: string | null;
  revokedAt: string | null;
  favouriteCount: number;
  viewCount: number;
  lastViewedAt: string | null;
  approvedAt: string | null;
}

function when(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Shown once after creation. The link cannot be recovered later. */
function ShareLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === 'undefined' ? path : `${window.location.origin}${path}`;

  return (
    <div className="rounded-md border border-success/30 bg-success-subtle p-3">
      <p className="text-xs font-medium text-success">
        Copy this now — it is not stored and cannot be shown again.
      </p>
      <div className="mt-2 flex gap-2">
        <Input readOnly value={url} onFocus={(event) => event.target.select()} />
        <Button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(url).then(() => setCopied(true));
          }}
        >
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}

export function GalleryPanel({
  shootId,
  galleries,
}: {
  shootId: string;
  galleries: GalleryRowView[];
}) {
  const [createState, createAction, creating] = useActionState(
    createGallery,
    GALLERY_ADMIN_IDLE,
  );
  const [revokeState, revokeAction, revoking] = useActionState(
    revokeGallery,
    GALLERY_ADMIN_IDLE,
  );
  const [applyState, applyAction, applying] = useActionState(
    applyFavouritesAsSelects,
    GALLERY_ADMIN_IDLE,
  );
  const [showForm, setShowForm] = useState(false);

  return (
    <Card className="mt-6">
      <CardHeader
        title="Client gallery"
        description="Share these photographs with the client so they can choose their favourites."
        action={
          <Button type="button" onClick={() => setShowForm((open) => !open)}>
            <Link2 size={14} aria-hidden="true" />
            {showForm ? 'Cancel' : 'New gallery'}
          </Button>
        }
      />

      <CardBody className="space-y-4">
        {createState.error ? <ErrorNote>{createState.error}</ErrorNote> : null}
        {revokeState.error ? <ErrorNote>{revokeState.error}</ErrorNote> : null}
        {applyState.error ? <ErrorNote>{applyState.error}</ErrorNote> : null}

        {applyState.message ? (
          <p role="status" className="text-sm text-success">
            {applyState.message}
          </p>
        ) : null}

        {createState.shareUrl ? <ShareLink path={createState.shareUrl} /> : null}

        {showForm ? (
          <form action={createAction} className="space-y-4 rounded-md border border-subtle p-4">
            <input type="hidden" name="shootId" value={shootId} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" htmlFor="gallery-title" hint="Defaults to the shoot name.">
                <Input id="gallery-title" name="title" placeholder="Priya & Dev — September" />
              </Field>

              <Field
                label="Password"
                htmlFor="gallery-password"
                hint="Optional. Leave blank for a link-only gallery."
              >
                <Input id="gallery-password" name="password" autoComplete="off" />
              </Field>
            </div>

            <Field label="Message to the client" htmlFor="gallery-message">
              <Textarea
                id="gallery-message"
                name="message"
                rows={2}
                placeholder="Here are your photographs — pick your favourites and approve when you're happy."
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Expires after"
                htmlFor="gallery-expiry"
                hint="Days. Blank means no expiry."
              >
                <Input id="gallery-expiry" name="expiresInDays" inputMode="numeric" placeholder="90" />
              </Field>

              {/* No download-quality control. It existed, was stored, and was
                  never honoured — every download served the original either
                  way. Resizing needs Supabase image transformation, which is a
                  paid feature and not enabled, so offering the choice was a
                  promise the app could not keep. */}
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  name="allowDownloads"
                  defaultChecked
                  className="size-4 accent-accent"
                />
                Allow downloads
              </label>

              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <input type="checkbox" name="watermark" className="size-4 accent-accent" />
                Watermark previews
              </label>
            </div>

            <Button type="submit" variant="primary" disabled={creating}>
              {creating ? 'Creating…' : 'Create gallery'}
            </Button>
          </form>
        ) : null}

        {galleries.length === 0 ? (
          <p className="text-sm text-muted">
            No gallery yet. Create one to send the client a private link — they
            can favourite photographs and approve a final set.
          </p>
        ) : (
          <ul className="divide-y divide-subtle">
            {galleries.map((gallery) => (
              <li key={gallery.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                    {gallery.title || 'Untitled gallery'}
                    {gallery.revokedAt ? (
                      <Badge tone="neutral">Closed</Badge>
                    ) : gallery.approvedAt ? (
                      <Badge tone="success">Approved</Badge>
                    ) : (
                      <Badge tone="accent">Open</Badge>
                    )}
                    {gallery.hasPassword ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted">
                        <Lock size={12} aria-hidden="true" />
                        Password
                      </span>
                    ) : null}
                  </p>

                  <p className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Heart size={12} aria-hidden="true" />
                      {gallery.favouriteCount} chosen
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Eye size={12} aria-hidden="true" />
                      {gallery.viewCount} views
                    </span>
                    <span>Last opened {when(gallery.lastViewedAt)}</span>
                    {gallery.expiresAt ? <span>Expires {when(gallery.expiresAt)}</span> : null}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  {gallery.favouriteCount > 0 ? (
                    <form action={applyAction}>
                      <input type="hidden" name="galleryId" value={gallery.id} />
                      <Button type="submit" disabled={applying}>
                        Use their picks
                      </Button>
                    </form>
                  ) : null}

                  {gallery.revokedAt ? null : (
                    <form action={revokeAction}>
                      <input type="hidden" name="galleryId" value={gallery.id} />
                      <Button type="submit" disabled={revoking}>
                        <X size={14} aria-hidden="true" />
                        Close
                      </Button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
