'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Sparkles } from 'lucide-react';
import {
  Badge,
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
import type { CampaignPlaybookRow } from '@/lib/planner/types';
import { SEASON_LABELS, WEEKDAY_OPTIONS, sortSeasons } from '@/lib/planner/display';
import { sanitizePostingDays } from '@/lib/planner/dates';
import { createCampaign } from '../actions';
import { asCampaignTag } from '@/lib/validators';

const POST_COUNTS = Array.from(
  { length: MAX_POST_COUNT - MIN_POST_COUNT + 1 },
  (_, index) => MIN_POST_COUNT + index,
);

const NO_PLAYBOOK = '';

export function CreateCampaignForm({
  aiConfigured,
  links,
  playbooks,
}: {
  aiConfigured: boolean;
  links: PlatformLinks;
  playbooks: CampaignPlaybookRow[];
}) {
  const [state, action, pending] = useActionState(createCampaign, IDLE);
  const firstPublishable = SOCIAL_PLATFORMS.find(
    (platform) => links[platform].canPublish,
  );
  // Which button was pressed, so the pending label describes what is happening.
  const [mode, setMode] = useState<'generate' | 'manual'>(
    aiConfigured ? 'generate' : 'manual',
  );

  const playbooksById = useMemo(
    () => new Map(playbooks.map((playbook) => [playbook.id, playbook])),
    [playbooks],
  );
  const seasons = useMemo(
    () => sortSeasons([...new Set(playbooks.map((p) => asCampaignTag(p.season)))]),
    [playbooks],
  );

  const [playbookId, setPlaybookId] = useState(NO_PLAYBOOK);
  const [audience, setAudience] = useState('');
  const [brief, setBrief] = useState('');
  const [postingDays, setPostingDays] = useState<number[]>([1, 3, 5]);
  const [postingTime, setPostingTime] = useState('10:00');

  const selectedPlaybook = playbookId ? playbooksById.get(playbookId) ?? null : null;

  /**
   * Picking a plan fills in audience, brief, posting days and time — the
   * "thought process and workflow" she asked for. A field is only overwritten
   * if it still matches what the *previous* plan put there (or was untouched
   * to begin with): once someone edits a field by hand, switching plans
   * leaves their words alone.
   */
  function handlePlaybookChange(nextId: string) {
    const previous = playbookId ? playbooksById.get(playbookId) ?? null : null;
    const next = nextId ? playbooksById.get(nextId) ?? null : null;
    setPlaybookId(nextId);
    if (!next) return;

    setAudience((current) =>
      current === '' || current === (previous?.audience_template ?? '')
        ? next.audience_template ?? ''
        : current,
    );
    setBrief((current) =>
      current === '' || current === (previous?.brief_template ?? '')
        ? next.brief_template ?? ''
        : current,
    );
    setPostingDays((current) => {
      const previousDefault = previous ? sanitizePostingDays(previous.posting_days) : [1, 3, 5];
      const unchanged =
        current.length === previousDefault.length &&
        current.every((day) => previousDefault.includes(day));
      return unchanged ? sanitizePostingDays(next.posting_days) : current;
    });
  }

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
          {playbooks.length > 0 ? (
            <Field
              label="Start from a plan"
              htmlFor="playbookId"
              hint="Fills in the audience, the brief, and a dated checklist below — every field stays editable."
            >
              <Select
                id="playbookId"
                name="playbookId"
                value={playbookId}
                onChange={(event) => handlePlaybookChange(event.target.value)}
              >
                <option value={NO_PLAYBOOK}>No plan — start from scratch</option>
                {seasons.map((season) => (
                  <optgroup key={season} label={SEASON_LABELS[season]}>
                    {playbooks
                      .filter((playbook) => playbook.season === season)
                      .map((playbook) => (
                        <option key={playbook.id} value={playbook.id}>
                          {playbook.cover_emoji ? `${playbook.cover_emoji} ` : ''}
                          {playbook.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </Select>
              {selectedPlaybook?.summary ? (
                <p className="mt-2 rounded-md border border-subtle bg-surface-raised px-3 py-2 text-xs text-muted">
                  {selectedPlaybook.summary}
                </p>
              ) : null}
            </Field>
          ) : null}

          <Field
            label="Goal"
            htmlFor="objective"
            hint="What this campaign is for. It shapes every caption."
            required
          >
            <Select
              id="objective"
              name="objective"
              defaultValue={selectedPlaybook?.objective ?? 'book_more_shoots'}
              key={selectedPlaybook?.objective ?? 'book_more_shoots'}
            >
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
                      // A plan's own platforms win when one is picked. Otherwise
                      // default to what can actually be published to, rather
                      // than always Instagram — pre-ticking a platform with no
                      // linked account builds a campaign that cannot ship.
                      defaultChecked={
                        selectedPlaybook
                          ? selectedPlaybook.platforms.includes(platform)
                          : link.canPublish && platform === firstPublishable
                      }
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
            <Textarea
              id="audience"
              name="audience"
              maxLength={500}
              rows={2}
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
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
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
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

            <Field
              label="Starts"
              htmlFor="startsOn"
              hint={playbookId ? 'Required — the plan’s tasks are dated from this.' : undefined}
              required={Boolean(playbookId)}
            >
              <Input id="startsOn" name="startsOn" type="date" required={Boolean(playbookId)} />
            </Field>

            <Field label="Ends" htmlFor="endsOn">
              <Input id="endsOn" name="endsOn" type="date" />
            </Field>
          </div>

          <fieldset>
            <legend className="block text-sm font-medium text-foreground">
              Posting schedule
            </legend>
            <p className="mt-1 text-xs text-muted">
              Which days this campaign posts on, and the time of day. Generated
              post tasks land on these days.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {WEEKDAY_OPTIONS.map((day) => {
                const checked = postingDays.includes(day.value);
                return (
                  <label
                    key={day.value}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-strong bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-hover"
                  >
                    <input
                      type="checkbox"
                      name="postingDays"
                      value={day.value}
                      checked={checked}
                      onChange={(event) =>
                        setPostingDays((current) =>
                          event.target.checked
                            ? sanitizePostingDays([...current, day.value])
                            : current.filter((value) => value !== day.value),
                        )
                      }
                      className="size-3.5 accent-accent"
                    />
                    <span aria-hidden="true">{day.short}</span>
                    <span className="sr-only">{day.long}</span>
                  </label>
                );
              })}
            </div>
            <div className="mt-3 max-w-[10rem]">
              <Field label="Posting time" htmlFor="postingTime">
                <Input
                  id="postingTime"
                  name="postingTime"
                  type="time"
                  value={postingTime}
                  onChange={(event) => setPostingTime(event.target.value)}
                />
              </Field>
            </div>
          </fieldset>
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

      {selectedPlaybook ? (
        <p className="flex items-center gap-2 text-xs text-muted">
          <Badge tone="accent">{SEASON_LABELS[selectedPlaybook.season]}</Badge>
          The checklist for “{selectedPlaybook.name}” is added once the campaign is
          created.
        </p>
      ) : null}
    </form>
  );
}
