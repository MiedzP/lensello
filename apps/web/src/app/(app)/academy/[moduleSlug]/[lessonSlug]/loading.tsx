import { PageHeader, SkeletonList } from '@/components/ui';

export default function AcademyLessonLoading() {
  return (
    <>
      <PageHeader title="Loading…" />
      <SkeletonList rows={4} />
    </>
  );
}
