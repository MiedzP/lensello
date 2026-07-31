'use client';

import { useActionState, useState, useTransition } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import {
  AD_PLATFORMS,
  SHOOT_TYPES,
  SHOOT_TYPE_LABELS,
  type AdPlatform,
  type ShootType,
} from '@lensello/core';
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
  AD_CALL_TO_ACTIONS,
  AD_PLATFORM_LABELS,
  HEADLINE_MAX_CHARS,
  PRIMARY_TEXT_MAX_CHARS,
} from '@/lib/ads/constants';
import { centsToBudgetInput } from '@/lib/ads/format';
import type { CampaignOption, CreativeGroup } from '@/lib/ads/queries';
import type { CopyVariant } from '@/lib/ads/schema';
import {
  createAd,
  generateAdCopy,
  updateAd,
  EMPTY_FORM_STATE,
  type AdFormState,
} from '../actions';
import { CopyVariants } from './copy-variants';
import { CreativePicker } from './creative-picker';

export interface AdFormValues {
  id?: string;
  name: string;
  platform: AdPlatform;
  headline: string;
  primaryText: string;
  callToAction: string;
  dailyBudgetCents: number;
  audience: string;
  assetId: string;
  campaignId: string;
  startsOn: string;
  endsOn: string;
}

export const BLANK_AD: AdFormValues = {
  name: '',
  platform: 'meta',
  headline: '',
  primaryText: '',
  callToAction: 'Learn more',
  dailyBudgetCents: 0,
  audience: '',
  assetId: '',
  campaignId: '',
  startsOn: '',
  endsOn: '',
};

/**
 * The create/edit form for an ad.
 *
 * Client-side because the copy generator has to be able to fill three fields at
 * once from a variant the user picks, which means those fields are React state
 * rather than plain uncontrolled inputs. The rest stay uncontrolled — there is
 * no reason to re-render the whole form because someone typed in the name box.
 *
 * The AI panel sits outside the `<form>` on purpose. HTML forbids nested forms,
 * and the generator is not a submission of this form: it is a separate server
 * call whose result the user may or may not accept.
 */
export function AdForm({
  mode,
  initial,
  campaigns,
  creatives,
  shootTypesInUse,
  aiEnabled,
}: {
  mode: 'create' | 'edit';
  initial: AdFormValues;
  campaigns: readonly CampaignOption[];
  creatives: readonly CreativeGroup[];
  shootTypesInUse: readonly string[];
  aiEnabled: boolean;
}) {
  const [state, action, pending] = useActionState<AdFormState, FormData>(
    mode === 'create' ? createAd : updateAd,
    EMPTY_FORM_STATE,
  );

  // Written by the variant picker, so they have to be state.
  const [headline, setHeadline] = useState(initial.headline);
  const [primaryText, setPrimaryText] = useState(initial.primaryText);
  const [callToAction, setCallToAction] = useState(initial.callToAction);
  const [audience, setAudience] = useState(initial.audience);
  const [assetId, setAssetId] = useState(initial.assetId);

  // Generator-only inputs: they shape the prompt and are never persisted.
  // Default to a shoot type the studio actually has work for, so the copy is
  // about something the portfolio can back up.
  const [shootType, setShootType] = useState<ShootType>(
    () =>
      SHOOT_TYPES.find((type) => shootTypesInUse.includes(type)) ?? 'portrait',
  );
  const [offer, setOffer] = useState('');
  const [variants, setVariants] = useState<CopyVariant[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [generating, startGenerating] = useTransition();

  function generate() {
    setAiError(null);
    startGenerating(async () => {
      const result = await generateAdCopy({
        shootType,
        audience: audience.trim() || null,
        offer: offer.trim() || null,
        variantCount: 4,
      });
      setVariants(result.variants);
      setAiError(result.error);
    });
  }

  function applyVariant(variant: CopyVariant) {
    setHeadline(variant.headline);
    setPrimaryText(variant.primaryText);
    // Null means the model answered off-list. Leave the user's own choice
    // standing rather than overwriting it with something unsupported.
    if (variant.callToAction) setCallToAction(variant.callToAction);
  }

  const headlineOver = headline.length > HEADLINE_MAX_CHARS;
  const primaryOver = primaryText.length > PRIMARY_TEXT_MAX_CHARS;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Copy variants"
          description={
            aiEnabled
              ? 'Generate several angles to split-test, then apply the one you want to start from.'
              : undefined
          }
        />
        <CardBody className="space-y-4">
          {aiEnabled ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="What is this ad selling?"
                  htmlFor="gen-shoot-type"
                  hint="Sets the service the copy talks about."
                >
                  <Select
                    id="gen-shoot-type"
                    value={shootType}
                    onChange={(event) =>
                      setShootType(event.target.value as ShootType)
                    }
                  >
                    {SHOOT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {SHOOT_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  label="Offer"
                  htmlFor="gen-offer"
                  hint="Optional. A package, a discount, an open date."
                >
                  <Input
                    id="gen-offer"
                    value={offer}
                    onChange={(event) => setOffer(event.target.value)}
                    placeholder="Two-hour session, 40 edited photos"
                  />
                </Field>
              </div>

              <p className="text-xs text-muted">
                The audience field further down is used as grounding too, so fill
                it in first for sharper copy.
              </p>

              <Button
                variant="primary"
                onClick={generate}
                disabled={generating}
              >
                <Sparkles size={15} aria-hidden="true" />
                {generating
                  ? 'Writing variants…'
                  : variants.length > 0
                    ? 'Generate again'
                    : 'Generate variants'}
              </Button>

              {aiError ? <ErrorNote>{aiError}</ErrorNote> : null}

              {variants.length > 0 ? (
                <CopyVariants variants={variants} onApply={applyVariant} />
              ) : null}
            </>
          ) : (
            // No key configured. Explain it and get out of the way — rendering
            // a Generate button that could only throw would be worse than
            // rendering none.
            <p className="text-sm text-muted">
              AI copy generation is unavailable because this deployment has no{' '}
              <code className="rounded bg-surface-raised px-1 py-0.5 text-xs">
                ANTHROPIC_API_KEY
              </code>{' '}
              set. Write the headline and primary text yourself below — nothing
              else on this form depends on it.
            </p>
          )}
        </CardBody>
      </Card>

      <form action={action}>
        {mode === 'edit' && initial.id ? (
          <input type="hidden" name="adId" value={initial.id} />
        ) : null}
        {/* The picker's radios are controlled React state; this is what the
            form actually submits. */}
        <input type="hidden" name="assetId" value={assetId} />

        <Card>
          <CardHeader title="Ad" description="Name, placement, and budget." />
          <CardBody className="space-y-4">
            {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" htmlFor="name" required>
                <Input
                  id="name"
                  name="name"
                  defaultValue={initial.name}
                  required
                  maxLength={120}
                  placeholder="Fall family minis — Meta"
                />
              </Field>

              <Field label="Platform" htmlFor="platform" required>
                <Select id="platform" name="platform" defaultValue={initial.platform}>
                  {AD_PLATFORMS.map((platform) => (
                    <option key={platform} value={platform}>
                      {AD_PLATFORM_LABELS[platform]}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Daily budget"
                htmlFor="dailyBudget"
                hint="US dollars per day. An ad needs a budget above $0 before it can go live."
              >
                <Input
                  id="dailyBudget"
                  name="dailyBudget"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  className="tabular-nums"
                  defaultValue={centsToBudgetInput(initial.dailyBudgetCents)}
                />
              </Field>

              <Field
                label="Marketing campaign"
                htmlFor="campaignId"
                hint="Optional. Links this ad to the campaign it supports."
              >
                <Select
                  id="campaignId"
                  name="campaignId"
                  defaultValue={initial.campaignId}
                >
                  <option value="">Not linked</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Starts on" htmlFor="startsOn">
                <Input
                  id="startsOn"
                  name="startsOn"
                  type="date"
                  defaultValue={initial.startsOn}
                />
              </Field>

              <Field label="Ends on" htmlFor="endsOn">
                <Input
                  id="endsOn"
                  name="endsOn"
                  type="date"
                  defaultValue={initial.endsOn}
                />
              </Field>
            </div>

            <Field
              label="Audience"
              htmlFor="audience"
              hint="Who this is aimed at. Also used as grounding for generated copy."
            >
              <Textarea
                id="audience"
                name="audience"
                value={audience}
                onChange={(event) => setAudience(event.target.value)}
                className="min-h-16"
                placeholder="Parents of young kids within 30 miles, 30-45"
              />
            </Field>
          </CardBody>
        </Card>

        <Card className="mt-6">
          <CardHeader
            title="Creative"
            description="The copy and image the feed will show."
          />
          <CardBody className="space-y-4">
            <Field
              label="Headline"
              htmlFor="headline"
              hint={`Under ${HEADLINE_MAX_CHARS} characters.`}
              error={
                headlineOver
                  ? `${headline.length}/${HEADLINE_MAX_CHARS} — this will be cut off in the feed.`
                  : null
              }
            >
              <Input
                id="headline"
                name="headline"
                value={headline}
                onChange={(event) => setHeadline(event.target.value)}
                aria-invalid={headlineOver || undefined}
                placeholder="Fall minis, three dates left"
              />
            </Field>

            <Field
              label="Primary text"
              htmlFor="primaryText"
              hint={`Under ${PRIMARY_TEXT_MAX_CHARS} characters.`}
              error={
                primaryOver
                  ? `${primaryText.length}/${PRIMARY_TEXT_MAX_CHARS} — this will be cut off in the feed.`
                  : null
              }
            >
              <Textarea
                id="primaryText"
                name="primaryText"
                value={primaryText}
                onChange={(event) => setPrimaryText(event.target.value)}
                aria-invalid={primaryOver || undefined}
                placeholder="Twenty minutes in the orchard, forty edited photos back within a week."
              />
            </Field>

            <Field label="Call to action" htmlFor="callToAction" required>
              <Select
                id="callToAction"
                name="callToAction"
                value={callToAction}
                onChange={(event) => setCallToAction(event.target.value)}
              >
                {AD_CALL_TO_ACTIONS.map((cta) => (
                  <option key={cta} value={cta}>
                    {cta}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Creative image</p>
              <p className="text-xs text-muted">
                Chosen from the photo library. Previews use short-lived signed
                URLs because the bucket is private.
              </p>
              <CreativePicker
                groups={creatives}
                value={assetId}
                onChange={setAssetId}
              />
            </div>
          </CardBody>

          <CardFooter>
            {state.saved && !state.error ? (
              <p role="status" aria-live="polite" className="mr-auto text-sm text-success">
                Saved.
              </p>
            ) : null}
            <Link
              href={mode === 'edit' && initial.id ? `/ads/${initial.id}` : '/ads'}
              className="px-3 text-sm text-muted hover:text-foreground"
            >
              Cancel
            </Link>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending
                ? 'Saving…'
                : mode === 'create'
                  ? 'Create ad'
                  : 'Save changes'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
