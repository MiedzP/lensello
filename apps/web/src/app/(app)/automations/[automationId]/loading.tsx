import { PageHeader, SkeletonList } from '@/components/ui';

export default function Loading() {
  return (
    <>
      <PageHeader title="Automation" />
      <SkeletonList rows={6} />
    </>
  );
}
