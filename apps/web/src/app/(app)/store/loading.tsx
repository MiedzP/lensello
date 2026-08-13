import { PageHeader, SkeletonList } from '@/components/ui';

export default function Loading() {
  return (
    <>
      <PageHeader title="Store" description="Print catalogue, client orders and lab fulfilment." />
      <SkeletonList rows={6} />
    </>
  );
}
