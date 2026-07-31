'use client';

import { Button, ErrorNote, PageHeader } from '@/components/ui';

/**
 * Error boundary for `/library` and everything under it.
 *
 * The read helpers throw with a human-readable message, so it is safe to show
 * `error.message` here rather than a generic apology.
 */
export default function LibraryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <PageHeader title="Library" />
      <ErrorNote>{error.message || 'Something went wrong loading the library.'}</ErrorNote>
      <div className="mt-4">
        <Button onClick={reset}>Try again</Button>
      </div>
    </>
  );
}
