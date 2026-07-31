import Link from 'next/link';
import { UserX } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/ui';

export default function ClientNotFound() {
  return (
    <>
      <PageHeader title="Client not found" />
      <EmptyState
        icon={<UserX size={26} aria-hidden="true" />}
        title="No client with that id"
        description="It may have been deleted, or the link may be wrong."
        action={
          <Link
            href="/clients"
            className="text-sm font-medium text-accent hover:underline"
          >
            Back to the inbox
          </Link>
        }
      />
    </>
  );
}
