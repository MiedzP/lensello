import { PageHeader, SkeletonList } from '@/components/ui';

export default function BusinessProfileLoading() {
  return (
    <>
      <PageHeader title="Business profile" />
      <SkeletonList rows={6} />
    </>
  );
}
