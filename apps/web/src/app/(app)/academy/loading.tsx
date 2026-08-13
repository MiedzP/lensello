import { PageHeader, SkeletonList } from '@/components/ui';

export default function AcademyLoading() {
  return (
    <>
      <PageHeader title="Academy" description="Marketing training, worksheets, and what Lensello knows about the business." />
      <SkeletonList rows={6} />
    </>
  );
}
