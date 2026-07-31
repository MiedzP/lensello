import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading gigs…</span>
      <Skeleton className="mb-6 h-8 w-40" />
      <Skeleton className="mb-5 h-9 w-full max-w-lg" />
      <Skeleton className="mb-5 h-24 w-full" />
      {/* Roughly the height of a six-week month grid, so the page does not
          jump when the calendar arrives. */}
      <Skeleton className="h-[34rem] w-full" />
    </div>
  );
}
