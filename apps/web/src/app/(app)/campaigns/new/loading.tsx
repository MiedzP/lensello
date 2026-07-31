import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-[36rem] w-full" />
    </div>
  );
}
