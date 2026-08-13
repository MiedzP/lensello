'use client';

import { useActionState, useState } from 'react';
import { Send } from 'lucide-react';
import { CAMPAIGN_OBJECTIVE_LABELS, CAMPAIGN_OBJECTIVES, SOCIAL_PLATFORMS } from '@lensello/core';
import { Button, Card, CardBody, CardHeader, ErrorNote, Field, Input, Select, Textarea } from '@/components/ui';
import { pushApprovedToCampaign } from '../../actions';
import { IDLE } from '../../action-state';

export interface CampaignOption {
  id: string;
  name: string;
}

const NEW_CAMPAIGN = '__new__';

/**
 * The last step: turning approved photos into a draft post.
 *
 * This never publishes anything. It creates (or reuses) a campaign and adds
 * one draft `campaign_posts` row carrying the approved asset ids — from
 * there the normal campaigns workflow (write copy, approve the post,
 * publish) takes over, unchanged.
 */
export function PushToCampaignForm({
  requestId,
  approvedCount,
  campaigns,
}: {
  requestId: string;
  approvedCount: number;
  campaigns: CampaignOption[];
}) {
  const [state, action, pending] = useActionState(pushApprovedToCampaign, IDLE);
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? NEW_CAMPAIGN);

  return (
    <Card>
      <CardHeader
        title="Push to a campaign"
        description={
          approvedCount > 0
            ? `${approvedCount} approved photo${approvedCount === 1 ? '' : 's'} will be attached to a new draft post.`
            : 'Approve at least one photo above first.'
        }
      />
      <CardBody className="space-y-4">
        {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}

        <form action={action} className="space-y-4">
          <input type="hidden" name="requestId" value={requestId} />

          <Field label="Campaign" htmlFor="push-campaign">
            <Select
              id="push-campaign"
              value={campaignId}
              onChange={(event) => setCampaignId(event.target.value)}
            >
              <option value={NEW_CAMPAIGN}>Create a new campaign…</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </Select>
            <input
              type="hidden"
              name="campaignId"
              value={campaignId === NEW_CAMPAIGN ? '' : campaignId}
            />
          </Field>

          {campaignId === NEW_CAMPAIGN ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="New campaign name" htmlFor="push-new-name">
                <Input id="push-new-name" name="newCampaignName" maxLength={120} placeholder="From the studio" />
              </Field>
              <Field label="Objective" htmlFor="push-objective">
                <Select id="push-objective" name="objective" defaultValue="showcase_portfolio">
                  {CAMPAIGN_OBJECTIVES.map((objective) => (
                    <option key={objective} value={objective}>
                      {CAMPAIGN_OBJECTIVE_LABELS[objective]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          ) : null}

          <Field label="Platform" htmlFor="push-platform">
            <Select id="push-platform" name="platform" defaultValue={SOCIAL_PLATFORMS[0]}>
              {SOCIAL_PLATFORMS.map((platform) => (
                <option key={platform} value={platform}>
                  {platform}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Caption" htmlFor="push-caption" hint="Optional — write it now, or leave blank and do it from the campaign.">
            <Textarea id="push-caption" name="caption" rows={3} maxLength={2200} />
          </Field>

          <Button type="submit" variant="primary" disabled={pending || approvedCount === 0}>
            <Send size={14} aria-hidden="true" />
            {pending ? 'Pushing…' : 'Push to campaign'}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
