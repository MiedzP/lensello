import { PageHeader, SkeletonList } from '@/components/ui';

export default function Loading() {
  return (
    <>
      <PageHeader title="API keys" />
      <SkeletonList rows={3} />
    </>
  );
}
