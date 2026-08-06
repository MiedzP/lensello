'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Loader2, Sparkles } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  ErrorNote,
  Field,
  Input,
  Select,
  Textarea,
} from '@/components/ui';
import {
  CAMPAIGN_OBJECTIVES,
  CAMPAIGN_OBJECTIVE_LABELS,
  SOCIAL_PLATFORMS,
} from '@lensello/core';
import { IDLE } from '@/lib/campaigns/action-state';
import { MAX_POST_COUNT, MIN_POST_COUNT } from '@/lib/campaigns/validation';
import { PLATFORM_LABELS } from '@/lib/campaigns/display';
import { linkNote, type PlatformLinks } from '@/lib/connections/links';
import { createCampaign } from '../actions';

const POST_COUNTS = Array.from(
  { length: MAX_POST_COUNT - MIN_POST_COUNT + 1 },
  (_, index) => MIN_POST_COUNT + index,
);

export function CreateCampaignForm({
  aiConfigured,
  links,
}: {
  aiConfigured: boolean;
  links: PlatformLinks;
}) {
  const [state, action, pending] = useActionState(createCampaign, IDLE);
  const firstPublishable = SOCIAL_PLATFORMS.find(
    (platform) => links[platform].canPublish,
  );
  // Which button was pressed, so the pending label describes what is happening.
  const [mode, setMode] = useState<'generate' | 'manual'>(
    aiConfigured ? 'generate' : 'manual',
  );

  const generating = pending && mode === 'generate';

  return (
    <form action={action} className="space-y-4">
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}

      {!aiConfigured ? (
        <div
          role="status"
          className="rounded-md border border-subtle bg-surface-raised px-4 py-3 text-sm text-muted"
        >
          <p className="font-medium text-foreground">
            AI generation is switched off
          </p>
          <p className="mt-1">
            <code className="text-xs">ANTHROPIC_API_KEY</code> is not set on the
            server, so a plan cannot be drafted. You can still create the campaign
            and write its posts yourself — copy the key from{' '}
            <code className="text-xs">.env.example</code> into{' '}
            <code className="text-xs">.env.local</code> to enable generation.
          </p>
        </div>
      ) : null}

      <Card>
        <CardBody className="space-y-4">
          <Field
            label="Goal"
            htmlFor="objective"
            hint="What this campaign is for. It shapes every caption."
            required
          >
            <Select id="objective" name="objective" defaultValue="book_more_shoots">
              {CAMPAIGN_OBJECTIVES.map((objective) => (
                <option key={objective} value={objective}>
                  {CAMPAIGN_OBJECTIVE_LABELS[objective]}
                </option>
              ))}
            </Select>
          </Field>

          <fieldset>
            <legend className="block text-sm font-medium text-foreground">
              Platforms <span className="text-danger">*</span>
            </legend>
            <p className="mt-1 text-xs text-muted">
              Posts are only written for the platforms you pick here.
            </p>
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
                      // Default to what can actually be published to, rather
                      // than always Instagram — pre-ticking a platform with no
                      // linked account builds a campaign that cannot ship.
                      defaultChecked={link.canPublish && platform === firstPublishable}
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

            {!firstPublishable ? (
              <p className="mt-2 text-xs text-warning">
                No account is linked yet, so nothing in this campaign will be
                able to publish.{' '}
                <Link href="/connections" className="text-accent hover:underline">
                  Link an account
                </Link>
                . You can still build the campaign now and publish later.
              </p>
            ) : null}
          </fieldset>

          <Field
            label="Audience"
            htmlFor="audience"
            hint="Who this is aimed at, e.g. “engaged couples in Boston, 25-34”."
          >
            <Input
              id="audience"
              name="audience"
              maxLength={500}
              placeholder="Engaged couples planning a 2027 wedding"
            />
          </Field>

          <Field
            label="Brief"
            htmlFor="brief"
            hint="Anything the copy should know: the offer, the work you want featured, dates to mention."
          >
            <Textarea
              id="brief"
              name="brief"
              maxLength={2000}
              rows={5}
              placeholder="Three barn weddings shot this autumn. I want to fill two open Saturdays in March and lead with the golden-hour portraits from the Willowmere set."
            />
          </Field>

          <Field
            label="Campaign name"
            htmlFor="name"
            hint={
              aiConfigured
                ? 'Optional — leave it blank and the AI will name it.'
                : 'Optional — defaults to the goal you picked.'
            }
          >
            <Input id="name" name="name" maxLength={120} placeholder="March date fill" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Posts to draft"
              htmlFor="postCount"
              hint={aiConfigured ? undefined : 'Used only when generating.'}
            >
              <Select
                id="postCount"
                name="postCount"
                defaultValue="4"
                disabled={!aiConfigured}
              >
                {POST_COUNTS.map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Starts" htmlFor="startsOn">
              <Input id="startsOn" name="startsOn" type="date" />
            </Field>

            <Field label="Ends" htmlFor="endsOn">
              <Input id="endsOn" name="endsOn" type="date" />
            </Field>
          </div>
        </CardBody>

        <CardFooter className="flex-wrap justify-between gap-3">
          <p className="text-xs text-muted" aria-live="polite">
            {generating
              ? 'Writing the plan. This takes 10–30 seconds — leave the page open.'
              : pending
                ? 'Saving…'
                : aiConfigured
                  ? 'Generation calls Claude once and saves every post as a draft.'
                  : 'The campaign is created empty; add posts on the next screen.'}
          </p>

          {/* Reversed: "Generate" is first in the DOM so pressing Enter in a
              field generates — the implicit submit uses the first submit button
              — while `flex-row-reverse` keeps the primary action on the right. */}
          <div className="flex flex-row-reverse flex-wrap gap-2">
            {aiConfigured ? (
              <>
                <Button
                  type="submit"
                  name="mode"
                  value="generate"
                  variant="primary"
                  disabled={pending}
                  onClick={() => setMode('generate')}
                >
                  {generating ? (
                    <>
                      <Loader2
                        size={15}
                        className="animate-spin"
                        aria-hidden="true"
                      />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles size={15} aria-hidden="true" />
                      Generate campaign
                    </>
                  )}
                </Button>
                <Button
                  type="submit"
                  name="mode"
                  value="manual"
                  disabled={pending}
                  onClick={() => setMode('manual')}
                >
                  Create without AI
                </Button>
              </>
            ) : (
              <Button
                type="submit"
                name="mode"
                value="manual"
                variant="primary"
                disabled={pending}
                onClick={() => setMode('manual')}
              >
                {pending ? 'Creating…' : 'Create campaign'}
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </form>
  );
}
