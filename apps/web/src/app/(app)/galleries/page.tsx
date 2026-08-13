import type { Metadata } from 'next';
import Link from 'next/link';
import { Images, Lock } from 'lucide-react';
import { Badge, EmptyState, PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { DISPLAY_STYLE_INFO, listGalleriesForStaff } from '@/lib/galleries/queries';

export const metadata: Metadata = { title: 'Galleries' };

/**
 * Presentation, sections and portal access for every gallery in the studio.
 *
 * A separate surface from the Library's own gallery panel on purpose: that
 * panel mints and revokes share links — the mechanics of *reaching* a
 * gallery. This one is about what the client sees once they're in it, which is
 * a different job the studio comes back to at a different time (usually once,
 * right before sending the link, rather than every time a gallery is created).
 */
export default async function GalleriesPage() {
  const { supabase } = await requireUserOrRedirect();
  const galleries = await listGalleriesForStaff(supabase);

  return (
    <>
      <PageHeader
        title="Galleries"
        description="Choose how each gallery is presented, group it into sections, and connect it to the client portal."
      />

      {galleries.length === 0 ? (
        <EmptyState
          icon={<Images size={22} aria-hidden="true" />}
          title="No galleries yet"
          description="Create a gallery for a shoot from the Library, then come back here to style it."
        />
      ) : (
        <ul className="divide-y divide-subtle rounded-lg border border-subtle bg-surface">
          {galleries.map(({ gallery, shootTitle, clientName }) => (
            <li key={gallery.id}>
              <Link
                href={`/galleries/${gallery.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-surface-hover"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {gallery.title || shootTitle}
                    {gallery.revoked_at ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted">
                        <Lock size={11} aria-hidden="true" />
                        Closed
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {shootTitle}
                    {clientName ? ` · ${clientName}` : ''}
                  </p>
                </div>

                <Badge tone="accent">{DISPLAY_STYLE_INFO[gallery.display_style].label}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
