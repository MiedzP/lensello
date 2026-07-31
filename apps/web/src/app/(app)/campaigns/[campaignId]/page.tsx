import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Images } from 'lucide-react';
import { Badge, EmptyState, PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { isAiConfigured } from '@/lib/ai';
import { pluralize } from '@/lib/utils';
import {
  CAMPAIGN_OBJECTIVE_LABELS,
  POST_STATUSES,
  SOCIAL_PLATFORMS,
  type CampaignObjective,
  type CampaignStatus,
  type PostStatus,
} from '@lensello/core';
import {
  campaignPlatforms,
  getCampaign,
  listCampaignPosts,
  orderedPhotos,
  photoIndexFor,
} from '@/lib/campaigns/queries';
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_TONES,
  POST_STATUS_LABELS,
  POST_STATUS_TONES,
  formatDateWindow,
} from '@/lib/campaigns/display';
import { uuidSchema } from '@/lib/campaigns/validation';
import { CampaignSettingsForm } from '../components/campaign-settings-form';
import { PostCard } from '../components/post-card';
import { AddPostForm } from '../components/add-post-form';
import { PublishApprovedButton } from '../components/publish-approved-button';

export const metadata: Metadata = { title: 'Campaign' };

export default async function CampaignDetailPage(
  props: PageProps<'/campaigns/[campaignId]'>,
) {
  const { campaignId } = await props.params;
  const search = await props.searchParams;
  const { supabase } = await requireUserOrRedirect();

  // A malformed id is a 404, not a Postgres cast error surfacing as a 500.
  if (!uuidSchema.safeParse(campaignId).success) notFound();

  const campaign = await getCampaign(supabase, campaignId);
  if (!campaign) notFound();

  const posts = await listCampaignPosts(supabase, campaign.id);

  // One signing request for the whole page, not one per post.
  const photos = await photoIndexFor(
    supabase,
    posts.flatMap((post) => post.asset_ids),
  );

  const counts = POST_STATUSES.reduce<Record<PostStatus, number>>(
    (totals, status) => {
      totals[status] = posts.filter((post) => post.status === status).length;
      return totals;
    },
    { draft: 0, approved: 0, scheduled: 0, published: 0, failed: 0 },
  );

  const platforms = campaignPlatforms(campaign, SOCIAL_PLATFORMS);
  const dropped = Number(typeof search.dropped === 'string' ? search.dropped : 0);
  const aiConfigured = isAiConfigured();

  return (
    <>
      <Link
        href="/campaigns"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ChevronLeft size={15} aria-hidden="true" />
        Campaigns
      </Link>

      <PageHeader
        title={campaign.name}
        description={
          <>
            {CAMPAIGN_OBJECTIVE_LABELS[campaign.objective as CampaignObjective] ??
              campaign.objective}
            {' · '}
            {formatDateWindow(campaign.starts_on, campaign.ends_on)}
            {' · '}
            {pluralize(posts.length, 'post')}
          </>
        }
        action={
          <PublishApprovedButton
            campaignId={campaign.id}
            approvedCount={counts.approved}
          />
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge tone={CAMPAIGN_STATUS_TONES[campaign.status as CampaignStatus]}>
          {CAMPAIGN_STATUS_LABELS[campaign.status as CampaignStatus] ??
            campaign.status}
        </Badge>
        {POST_STATUSES.filter((status) => counts[status] > 0).map((status) => (
          <Badge key={status} tone={POST_STATUS_TONES[status]}>
            {counts[status]} {POST_STATUS_LABELS[status].toLowerCase()}
          </Badge>
        ))}
      </div>

      {Number.isInteger(dropped) && dropped > 0 ? (
        <div
          role="status"
          className="mb-6 rounded-md border border-warning/30 bg-warning-subtle px-4 py-3 text-sm text-warning"
        >
          {pluralize(dropped, 'generated post')} could not be used: the AI
          returned a platform this campaign does not target. Add a replacement
          below if you want the full set.
        </div>
      ) : null}

      <div className="space-y-6">
        <CampaignSettingsForm
          campaign={{
            id: campaign.id,
            name: campaign.name,
            objective: campaign.objective,
            status: campaign.status,
            brief: campaign.brief,
            audience: campaign.audience,
            platforms: campaign.platforms,
            startsOn: campaign.starts_on,
            endsOn: campaign.ends_on,
          }}
        />

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">
            Posts
            <span className="ml-2 text-xs font-normal text-muted">
              Each one is edited, approved, and published on its own.
            </span>
          </h2>

          {posts.length === 0 ? (
            <EmptyState
              icon={<Images size={24} aria-hidden="true" />}
              title="No posts in this campaign yet"
              description="Add one below, attach photos from the library, then approve it to publish."
            />
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={{
                  id: post.id,
                  platform: post.platform,
                  caption: post.caption,
                  hashtags: post.hashtags,
                  assetIds: post.asset_ids,
                  status: post.status,
                  scheduledFor: post.scheduled_for,
                  publishedAt: post.published_at,
                  externalId: post.external_id,
                  failureReason: post.failure_reason,
                }}
                photos={orderedPhotos(post.asset_ids, photos)}
                aiConfigured={aiConfigured}
              />
            ))
          )}
        </section>

        {/* Keyed on the post count so a successful add remounts the form with
            empty fields — leaving the caption sitting there reads as a failed
            submit. */}
        <AddPostForm
          key={posts.length}
          campaignId={campaign.id}
          campaignPlatforms={platforms}
        />
      </div>
    </>
  );
}
