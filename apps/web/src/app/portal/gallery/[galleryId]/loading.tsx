import { SkeletonList } from '@/components/ui';

export default function PortalGalleryLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <SkeletonList rows={6} />
    </div>
  );
}
