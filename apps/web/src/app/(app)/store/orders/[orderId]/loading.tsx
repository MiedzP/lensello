import { PageHeader, SkeletonList } from '@/components/ui';

export default function Loading() {
  return (
    <>
      <PageHeader title="Order" />
      <SkeletonList rows={5} />
    </>
  );
}
