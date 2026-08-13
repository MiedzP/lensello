'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { ScanEye } from 'lucide-react';
import { Button, Card, CardBody, CardHeader, ErrorNote, Select } from '@/components/ui';
import type { ShootOption } from '@/lib/studio/queries';
import { fetchCaptionProgress, runCaptioning } from '../actions';
import { IDLE } from '../action-state';

/**
 * "Prepare the library for search."
 *
 * Every button click processes one bounded batch — see `runCaptioningBatch` —
 * so leaving this half-finished and coming back tomorrow is the normal case,
 * not a failure mode. Progress is re-read after every batch rather than
 * inferred from the returned counts, so a second staff member captioning the
 * same shoot in another tab is reflected too.
 */
export function CaptioningCard({ shootOptions }: { shootOptions: ShootOption[] }) {
  const [shootId, setShootId] = useState(shootOptions[0]?.id ?? '');
  const [progress, setProgress] = useState<{ total: number; captioned: number } | null>(null);
  const [loadingProgress, startLoadingProgress] = useTransition();
  const [state, action, pending] = useActionState(runCaptioning, IDLE);

  useEffect(() => {
    // `state` is a dependency so a completed batch re-reads progress
    // immediately, rather than waiting for the next shoot change.
    startLoadingProgress(async () => {
      setProgress(shootId ? await fetchCaptionProgress(shootId) : null);
    });
  }, [shootId, state]);

  if (shootOptions.length === 0) {
    return (
      <Card>
        <CardHeader
          title="Prepare your library for search"
          description="The brief box searches captions and labels, not filenames."
        />
        <CardBody className="text-sm text-muted">
          No shoots yet. Upload photos to a shoot first.
        </CardBody>
      </Card>
    );
  }

  const remaining = progress ? progress.total - progress.captioned : null;

  return (
    <Card>
      <CardHeader
        title="Prepare your library for search"
        description="The brief box only finds what has been captioned. Run this once per shoot, and again any time new photos arrive — it always picks up where it left off."
      />
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <Select
            value={shootId}
            onChange={(event) => setShootId(event.target.value)}
            className="max-w-xs"
            aria-label="Shoot to caption"
          >
            {shootOptions.map((shoot) => (
              <option key={shoot.id} value={shoot.id}>
                {shoot.title}
              </option>
            ))}
          </Select>

          <form action={action}>
            <input type="hidden" name="shootId" value={shootId} />
            <Button type="submit" variant="primary" disabled={pending || !shootId}>
              <ScanEye size={14} aria-hidden="true" />
              {pending ? 'Captioning…' : 'Caption more'}
            </Button>
          </form>

          <p className="text-sm text-muted">
            {loadingProgress
              ? 'Checking…'
              : progress
                ? remaining === 0
                  ? `All ${progress.total} photos captioned.`
                  : `${progress.captioned} of ${progress.total} captioned, ${remaining} to go.`
                : null}
          </p>
        </div>

        {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
        {state.message ? (
          <p role="status" className="text-sm text-success">
            {state.message}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
