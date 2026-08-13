import type { Metadata } from 'next';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Badge, EmptyState, PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { formatDate } from '@/lib/library/constants';
import {
  STUDIO_REQUEST_STATUS_LABELS,
  STUDIO_REQUEST_STATUS_TONES,
  type StudioRequestStatus,
} from '@/lib/studio/constants';
import { listShootOptions, listStudioRequests } from '@/lib/studio/queries';
import { BriefForm } from './components/brief-form';
import { CaptioningCard } from './components/captioning-card';

export const metadata: Metadata = { title: 'Studio' };

export default async function StudioPage() {
  const { supabase } = await requireUserOrRedirect();

  const [shootOptions, requests] = await Promise.all([
    listShootOptions(supabase),
    listStudioRequests(supabase),
  ]);

  return (
    <>
      <PageHeader
        title="Studio"
        description="Describe a post in plain English and Lensello finds the photographs for it. Nothing is used until you approve it."
      />

      <div className="grid gap-6">
        <CaptioningCard shootOptions={shootOptions} />
        <BriefForm shootOptions={shootOptions} />

        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Recent briefs</h2>
          {requests.length === 0 ? (
            <EmptyState
              icon={<Sparkles size={22} aria-hidden="true" />}
              title="No briefs yet"
              description="Describe a post above and Lensello will search the library for it."
            />
          ) : (
            <ul className="divide-y divide-subtle rounded-lg border border-subtle bg-surface">
              {requests.map((request) => (
                <li key={request.id}>
                  <Link
                    href={`/studio/${request.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-surface-hover"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {request.prompt}
                      </p>
                      <p className="mt-0.5 text-xs text-faint">
                        {formatDate(request.created_at) ?? request.created_at}
                      </p>
                    </div>
                    <Badge tone={STUDIO_REQUEST_STATUS_TONES[request.status as StudioRequestStatus]}>
                      {STUDIO_REQUEST_STATUS_LABELS[request.status as StudioRequestStatus]}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
