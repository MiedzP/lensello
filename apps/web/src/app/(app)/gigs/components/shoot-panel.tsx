import { Camera } from 'lucide-react';
import type { GigStatus } from '@lensello/core';
import { Badge, Button, Card, CardBody, CardHeader, Select } from '@/components/ui';
import type { ShootRef } from '@/lib/gigs/types';
import { createShootForGig, linkShootToGig } from '../actions';

/**
 * The handoff from a completed gig to the photo library.
 *
 * This module inserts a `shoots` stub (title, type, client, date, location) or
 * points an existing unlinked shoot at the gig, and then stops — culling,
 * assets, and delivery all belong to the library module. There is deliberately
 * no link through to a shoot detail page: that route belongs to another module
 * and does not exist yet.
 */
export function ShootPanel({
  gigId,
  status,
  shoot,
  candidates,
  shotAtLabel,
}: {
  gigId: string;
  status: GigStatus;
  shoot: ShootRef | null;
  candidates: ShootRef[];
  shotAtLabel: string | null;
}) {
  return (
    <Card>
      <CardHeader
        title="Photo library"
        description="Where this gig's photos live once it is shot."
        action={shoot ? <Badge tone="success">Linked</Badge> : null}
      />

      <CardBody className="space-y-4">
        {shoot ? (
          <div className="rounded-md border border-subtle bg-surface-raised px-3 py-2.5">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Camera size={15} aria-hidden="true" className="text-muted" />
              {shoot.title}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Shoot status: {shoot.status}
              {shotAtLabel ? ` · ${shotAtLabel}` : ''}
            </p>
            <p className="mt-1.5 text-xs text-faint">
              Manage the photos from the Library module.
            </p>
          </div>
        ) : status !== 'completed' ? (
          <p className="text-sm text-muted">
            No shoot record yet. When you mark this gig completed you will be offered one,
            so the photos have somewhere to land.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted">
              This gig is completed but has no shoot record. Create one, or attach a shoot
              you have already started.
            </p>

            <form action={createShootForGig}>
              <input type="hidden" name="gigId" value={gigId} />
              <Button type="submit" variant="primary" size="sm">
                <Camera size={15} aria-hidden="true" />
                Create the shoot record
              </Button>
            </form>

            {candidates.length > 0 ? (
              <form
                action={linkShootToGig}
                className="flex items-end gap-2 border-t border-subtle pt-4"
              >
                <input type="hidden" name="gigId" value={gigId} />
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor="link-shoot-id"
                    className="mb-1.5 block text-sm font-medium text-foreground"
                  >
                    Or link an existing shoot
                  </label>
                  <Select id="link-shoot-id" name="shootId" required defaultValue="">
                    <option value="" disabled>
                      Choose a shoot…
                    </option>
                    {candidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.title} ({candidate.status})
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="submit" size="sm">
                  Link
                </Button>
              </form>
            ) : null}
          </>
        )}
      </CardBody>
    </Card>
  );
}
