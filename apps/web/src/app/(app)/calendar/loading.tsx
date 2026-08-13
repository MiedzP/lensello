import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-56" />
      </div>
      <Skeleton className="h-[32rem] w-full" />
    </div>
  );
}
