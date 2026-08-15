import { PageHeader, Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <>
      <PageHeader title="Import from Drive" description="Loading this folder's photos…" />
      <div aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading photos…</span>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }, (_, index) => (
            <Skeleton key={index} className="aspect-square w-full" />
          ))}
        </div>
      </div>
    </>
  );
}
