import { PageHeader, SkeletonList } from '@/components/ui';

export default function Loading() {
  return (
    <>
      <PageHeader title="Catalogue" description="Print sizes, framing, canvas and albums the studio sells." />
      <SkeletonList rows={6} />
    </>
  );
}
