import { PageHeader, Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <>
      <PageHeader
        title="Import from Drive"
        description="Pull in-house work and personal photography out of Google Drive."
      />
      <div aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading Drive folders…</span>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      </div>
    </>
  );
}
