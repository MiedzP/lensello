import { Skeleton, SkeletonList } from '@/components/ui';

export default function Loading() {
  return (
    <div aria-busy="true">
      <div className="flex items-start justify-between gap-4 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="mb-5 h-9 w-56" />
      <SkeletonList rows={5} />
    </div>
  );
}
