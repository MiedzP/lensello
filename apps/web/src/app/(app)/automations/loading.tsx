import { PageHeader, SkeletonList } from '@/components/ui';

export default function Loading() {
  return (
    <>
      <PageHeader title="Automations" description="Trigger-and-step workflows, plus the API keys that drive them." />
      <SkeletonList rows={4} />
    </>
  );
}
