import { PageHeader, SkeletonList } from '@/components/ui';

export default function AcademyModuleLoading() {
  return (
    <>
      <PageHeader title="Loading…" />
      <SkeletonList rows={5} />
    </>
  );
}
