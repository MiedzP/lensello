import { SkeletonList } from '@/components/ui';

export default function PortalLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <SkeletonList rows={4} />
    </div>
  );
}
