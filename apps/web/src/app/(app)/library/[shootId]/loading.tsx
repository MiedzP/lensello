import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading shoot…</span>

      <div className="mb-6 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-56" />
      </div>

      <Skeleton className="mb-6 h-40 w-full" />

      <div className="mb-4 flex flex-wrap gap-3">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-14 w-40" />
        <Skeleton className="h-14 w-44" />
        <Skeleton className="h-14 w-44" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="aspect-square w-full" />
          ))}
        </div>
        <Skeleton className="hidden h-96 w-full lg:block" />
      </div>
    </div>
  );
}
