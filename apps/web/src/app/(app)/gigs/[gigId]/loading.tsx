import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the gig…</span>
      <Skeleton className="mb-4 h-4 w-28" />
      <Skeleton className="mb-6 h-8 w-72" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  );
}
