'use client';

import { Button, ErrorNote, PageHeader } from '@/components/ui';

/**
 * Error boundary for `/library/import` and everything under it. Mirrors
 * `library/error.tsx`: the read helpers here throw human-readable messages
 * (including `NotImplementedError` from an unconfigured Drive adapter), so
 * showing `error.message` directly is safe.
 */
export default function ImportError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <PageHeader title="Import from Drive" />
      <ErrorNote>{error.message || 'Something went wrong loading Drive.'}</ErrorNote>
      <div className="mt-4">
        <Button onClick={reset}>Try again</Button>
      </div>
    </>
  );
}
