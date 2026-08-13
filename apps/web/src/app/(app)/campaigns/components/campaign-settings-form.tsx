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
import { linkNote, type PlatformLinks } from '@/lib/connections/links';
import { WEEKDAY_OPTIONS, toTimeInputValue } from '@/lib/planner/display';
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
  postingDays: number[];
  postingTime: string;
}

export function CampaignSettingsForm({
  campaign,
  links,
}: {
  campaign: CampaignSettings;
  links: PlatformLinks;
}) {
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
              {SOCIAL_PLATFORMS.map((platform) => {
                const link = links[platform];
                return (
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
                    <span>
                      {PLATFORM_LABELS[platform]}
                      <span
                        className={
                          link.canPublish
                            ? 'ml-1.5 text-xs text-muted'
                            : 'ml-1.5 text-xs text-warning'
                        }
                      >
                        {linkNote(link)}
                      </span>
                    </span>
                  </label>
                );
              })}
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

          <fieldset>
            <legend className="block text-sm font-medium text-foreground">
              Posting schedule
            </legend>
            <p className="mt-1 text-xs text-muted">
              Which days this campaign posts on, and the time of day. Generated
              post tasks land on these days.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {WEEKDAY_OPTIONS.map((day) => (
                <label
                  key={day.value}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-strong bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-hover"
                >
                  <input
                    type="checkbox"
                    name="postingDays"
                    value={day.value}
                    defaultChecked={campaign.postingDays.includes(day.value)}
                    className="size-3.5 accent-accent"
                  />
                  <span aria-hidden="true">{day.short}</span>
                  <span className="sr-only">{day.long}</span>
                </label>
              ))}
            </div>
            <div className="mt-3 max-w-[10rem]">
              <Field label="Posting time" htmlFor="campaign-posting-time">
                <Input
                  id="campaign-posting-time"
                  name="postingTime"
                  type="time"
                  defaultValue={toTimeInputValue(campaign.postingTime)}
                />
              </Field>
            </div>
          </fieldset>
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
