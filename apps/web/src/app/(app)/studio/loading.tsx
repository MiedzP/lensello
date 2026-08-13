import { Skeleton, SkeletonList } from '@/components/ui';

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the studio…</span>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-64 w-full" />
      <SkeletonList rows={4} />
    </div>
  );
}
