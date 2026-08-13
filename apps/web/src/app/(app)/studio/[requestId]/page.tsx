import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Badge, Card, CardBody, CardHeader, PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { listCampaignSummaries } from '@/lib/campaigns/queries';
import {
  STUDIO_REQUEST_STATUS_LABELS,
  STUDIO_REQUEST_STATUS_TONES,
  type StudioRequestStatus,
} from '@/lib/studio/constants';
import { getGeneratedImages, getShortlist, getStudioRequest, listShootOptions } from '@/lib/studio/queries';
import { parseInterpretedBrief } from '@/lib/studio/types';
import { ArtworkPanel } from './components/artwork-panel';
import { PushToCampaignForm } from './components/push-to-campaign-form';
import { ShortlistGrid } from './components/shortlist-grid';

export const metadata: Metadata = { title: 'Brief' };

export default async function StudioRequestPage(props: PageProps<'/studio/[requestId]'>) {
  const { supabase } = await requireUserOrRedirect();
  const { requestId } = await props.params;

  const request = await getStudioRequest(supabase, requestId);
  if (!request) notFound();

  const [shortlist, images, campaigns, shootOptions] = await Promise.all([
    getShortlist(supabase, request.id),
    getGeneratedImages(supabase, request.id),
    listCampaignSummaries(supabase),
    listShootOptions(supabase),
  ]);

  const interpreted = parseInterpretedBrief(request.interpreted);
  const approvedCount = shortlist.filter((item) => item.decision === 'approved').length;
  const status = request.status as StudioRequestStatus;

  return (
    <>
      <Link
        href="/studio"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ChevronLeft size={15} aria-hidden="true" />
        Studio
      </Link>

      <PageHeader
        title={request.prompt}
        description={interpreted ? interpreted.summary : 'This brief has not been interpreted yet.'}
        action={<Badge tone={STUDIO_REQUEST_STATUS_TONES[status]}>{STUDIO_REQUEST_STATUS_LABELS[status]}</Badge>}
      />

      {interpreted ? (
        <Card className="mb-6">
          <CardHeader
            title="What Lensello searched for"
            description="Read this back before trusting the shortlist below — a wrong reading of the brief means a right ranking of the wrong photos."
          />
          <CardBody className="flex flex-wrap items-center gap-2">
            {interpreted.labels.length > 0 ? (
              interpreted.labels.map((label) => <Badge key={label}>{label}</Badge>)
            ) : (
              <span className="text-sm text-muted">No search terms were extracted.</span>
            )}
            {interpreted.shootType ? <Badge tone="accent">{interpreted.shootType}</Badge> : null}
            <span className="text-sm text-muted">
              · {interpreted.count} requested · via {interpreted.method === 'ai' ? 'AI reading' : 'heuristic reading'}
            </span>
          </CardBody>
        </Card>
      ) : null}

      {request.status === 'failed' && request.failure_reason ? (
        <Card className="mb-6 border-danger/30">
          <CardBody className="text-sm text-danger">{request.failure_reason}</CardBody>
        </Card>
      ) : null}

      <h2 className="mb-3 text-sm font-semibold text-foreground">
        Shortlist
        {shortlist.length > 0 ? (
          <span className="ml-2 text-xs font-normal text-muted">
            {approvedCount} of {shortlist.length} approved
          </span>
        ) : null}
      </h2>
      <ShortlistGrid items={shortlist} />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="order-2 lg:order-1">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Generated artwork</h2>
          <ArtworkPanel
            requestId={request.id}
            shortlist={shortlist}
            images={images}
            shootOptions={shootOptions}
            defaultStudioName={process.env.LENSELLO_STUDIO_NAME?.trim() || 'Lensello Photography'}
          />
        </div>

        <div className="order-1 lg:order-2">
          <PushToCampaignForm
            requestId={request.id}
            approvedCount={approvedCount}
            campaigns={campaigns.map((summary) => ({ id: summary.campaign.id, name: summary.campaign.name }))}
          />
        </div>
      </div>
    </>
  );
}
