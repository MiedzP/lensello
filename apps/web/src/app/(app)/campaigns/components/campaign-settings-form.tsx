'use client';

import { useActionState } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  ErrorNote,
  Field,
  Input,
  Select,
  Textarea,
} from '@/components/ui';
import {
  CAMPAIGN_OBJECTIVES,
  CAMPAIGN_OBJECTIVE_LABELS,
  CAMPAIGN_STATUSES,
  SOCIAL_PLATFORMS,
} from '@lensello/core';
import { IDLE } from '@/lib/campaigns/action-state';
import { CAMPAIGN_STATUS_LABELS, PLATFORM_LABELS } from '@/lib/campaigns/display';
import { updateCampaign } from '../actions';

export interface CampaignSettings {
  id: string;
  name: string;
  objective: string;
  status: string;
  brief: string | null;
  audience: string | null;
  platforms: string[];
  startsOn: string | null;
  endsOn: string | null;
}

export function CampaignSettingsForm({ campaign }: { campaign: CampaignSettings }) {
  const [state, action, pending] = useActionState(updateCampaign, IDLE);

  return (
    <Card>
      <CardHeader
        title="Campaign"
        description="The goal and audience here ground every caption the AI writes."
      />
      <form action={action}>
        <input type="hidden" name="campaignId" value={campaign.id} />

        <CardBody className="space-y-4">
          {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
          {state.message ? (
            <p role="status" className="text-sm text-success">
              {state.message}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="campaign-name" required>
              <Input
                id="campaign-name"
                name="name"
                defaultValue={campaign.name}
                maxLength={120}
                required
              />
            </Field>

            <Field label="Status" htmlFor="campaign-status">
              <Select
                id="campaign-status"
                name="status"
                defaultValue={campaign.status}
              >
                {CAMPAIGN_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {CAMPAIGN_STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Goal" htmlFor="campaign-objective">
              <Select
                id="campaign-objective"
                name="objective"
                defaultValue={campaign.objective}
              >
                {CAMPAIGN_OBJECTIVES.map((objective) => (
                  <option key={objective} value={objective}>
                    {CAMPAIGN_OBJECTIVE_LABELS[objective]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Audience" htmlFor="campaign-audience">
              <Input
                id="campaign-audience"
                name="audience"
                defaultValue={campaign.audience ?? ''}
                maxLength={500}
              />
            </Field>

            <Field label="Starts" htmlFor="campaign-starts">
              <Input
                id="campaign-starts"
                name="startsOn"
                type="date"
                defaultValue={campaign.startsOn ?? ''}
              />
            </Field>

            <Field label="Ends" htmlFor="campaign-ends">
              <Input
                id="campaign-ends"
                name="endsOn"
                type="date"
                defaultValue={campaign.endsOn ?? ''}
              />
            </Field>
          </div>

          <fieldset>
            <legend className="block text-sm font-medium text-foreground">
              Platforms
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {SOCIAL_PLATFORMS.map((platform) => (
                <label
                  key={platform}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-strong bg-surface px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-hover"
                >
                  <input
                    type="checkbox"
                    name="platforms"
                    value={platform}
                    defaultChecked={campaign.platforms.includes(platform)}
                    className="size-4 accent-accent"
                  />
                  {PLATFORM_LABELS[platform]}
                </label>
              ))}
            </div>
          </fieldset>

          <Field label="Brief" htmlFor="campaign-brief">
            <Textarea
              id="campaign-brief"
              name="brief"
              rows={4}
              maxLength={2000}
              defaultValue={campaign.brief ?? ''}
            />
          </Field>
        </CardBody>

        <CardFooter>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Saving…' : 'Save campaign'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
