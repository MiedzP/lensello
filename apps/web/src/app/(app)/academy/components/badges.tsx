import { Badge } from '@/components/ui';

export function PublishBadge({ isPublished }: { isPublished: boolean }) {
  return isPublished ? (
    <Badge tone="success">Published</Badge>
  ) : (
    <Badge tone="neutral">Draft</Badge>
  );
}

export function ProgressBadge({ status }: { status: 'in_progress' | 'complete' | null }) {
  if (status === 'complete') return <Badge tone="success">Complete</Badge>;
  if (status === 'in_progress') return <Badge tone="accent">In progress</Badge>;
  return <Badge tone="neutral">Not started</Badge>;
}
