import Link from 'next/link';
import { Images } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/ui';

export default function ShootNotFound() {
  return (
    <>
      <PageHeader title="Shoot not found" />
      <EmptyState
        icon={<Images size={24} aria-hidden="true" />}
        title="This shoot does not exist"
        description="It may have been deleted, or the link may be wrong."
        action={
          <Link href="/library" className="text-sm text-accent hover:underline">
            Back to the library
          </Link>
        }
      />
    </>
  );
}
