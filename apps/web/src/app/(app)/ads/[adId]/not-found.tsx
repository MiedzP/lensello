import { Target } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/ui';
import { LinkButton } from '../components/link-button';

export default function AdNotFound() {
  return (
    <>
      <PageHeader title="Ad not found" />
      <EmptyState
        icon={<Target size={22} aria-hidden="true" />}
        title="That ad does not exist"
        description="It may have been deleted, or the link may be wrong."
        action={<LinkButton href="/ads">Back to ads</LinkButton>}
      />
    </>
  );
}
