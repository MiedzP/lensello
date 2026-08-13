import { Skeleton, SkeletonList } from '@/components/ui';

export default function Loading() {
  return (
    <div aria-busy="true">
      <div className="flex items-start justify-between gap-4 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>
      <Skeleton className="mb-5 h-9 w-full max-w-md" />
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <SkeletonList rows={6} />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  );
}
