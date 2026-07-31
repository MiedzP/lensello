import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading campaign…</span>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-72 w-full" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
