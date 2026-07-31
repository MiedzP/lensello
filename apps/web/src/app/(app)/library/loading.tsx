import { PageHeader, Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <>
      <PageHeader
        title="Library"
        description="Every shoot in the studio, with its photos, selects, and tags."
      />
      <div aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading shoots…</span>
        <div className="mb-5 flex flex-wrap gap-3">
          <Skeleton className="h-14 w-44" />
          <Skeleton className="h-14 w-44" />
          <Skeleton className="h-14 w-56" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="aspect-4/3 w-full" />
          ))}
        </div>
      </div>
    </>
  );
}
