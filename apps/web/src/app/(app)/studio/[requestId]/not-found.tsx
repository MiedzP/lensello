import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { EmptyState, PageHeader } from '@/components/ui';

export default function StudioRequestNotFound() {
  return (
    <>
      <PageHeader title="Brief not found" />
      <EmptyState
        icon={<Sparkles size={22} aria-hidden="true" />}
        title="That brief does not exist"
        description="It may have been deleted, or the link may be wrong."
        action={
          <Link
            href="/studio"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-strong bg-surface px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
          >
            Back to Studio
          </Link>
        }
      />
    </>
  );
}
