'use client';

import { useActionState, useState } from 'react';
import Image from 'next/image';
import { ImageOff, Wand2 } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorNote,
  Field,
  Input,
  Select,
  Textarea,
} from '@/components/ui';
import { AD_SIZES, AD_SIZE_KEYS, CUSTOM_SIZE, type AdSizeKey } from '@/lib/creative/spec';
import type { ShootOption } from '@/lib/studio/queries';
import type { GeneratedImageView, ShortlistItemView } from '@/lib/studio/types';
import { generateArtwork, renderShortlistOverlay } from '../../actions';
import { IDLE } from '../../action-state';
import { GeneratedImageCard } from './generated-image-card';

const ASPECT_RATIOS = ['1:1', '4:5', '16:9', '9:16'] as const;

/**
 * Generated artwork for this brief — the "Canva functionality" from the
 * client meeting, built two ways:
 *
 * 1. `imageGen`, text-to-image, for a graphic that is not a photograph at all.
 * 2. The existing ad-creative compositor, laying a headline over a photo the
 *    studio's own search already shortlisted.
 *
 * Both land as `generated_images` rows, `decision: 'pending'`, shown together
 * below so approving and (eventually) filing one into the library works the
 * same way regardless of which produced it.
 */
export function ArtworkPanel({
  requestId,
  shortlist,
  images,
  shootOptions,
  defaultStudioName,
}: {
  requestId: string;
  shortlist: ShortlistItemView[];
  images: GeneratedImageView[];
  shootOptions: ShootOption[];
  defaultStudioName: string;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <GenerateForm requestId={requestId} />
        <OverlayForm requestId={requestId} shortlist={shortlist} defaultStudioName={defaultStudioName} />
      </div>

      {images.length > 0 ? (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Generated so far</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((image) => (
              <GeneratedImageCard key={image.id} image={image} shootOptions={shootOptions} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GenerateForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(generateArtwork, IDLE);

  return (
    <Card>
      <CardHeader
        title="Generate a graphic"
        description="Text-to-image, through the imageGen adapter. Not a photograph — never filed as one without an explicit promotion."
      />
      <CardBody className="space-y-4">
        {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
        {state.message ? (
          <p role="status" className="text-sm text-success">
            {state.message}
          </p>
        ) : null}

        <form action={action} className="space-y-4">
          <input type="hidden" name="requestId" value={requestId} />

          <Field label="Prompt" htmlFor="artwork-prompt">
            <Textarea
              id="artwork-prompt"
              name="prompt"
              rows={3}
              maxLength={500}
              placeholder="A soft watercolour texture in warm autumn tones, for a seasonal promo background"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Aspect ratio" htmlFor="artwork-aspect">
              <Select id="artwork-aspect" name="aspectRatio" defaultValue="1:1">
                {ASPECT_RATIOS.map((ratio) => (
                  <option key={ratio} value={ratio}>
                    {ratio}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="How many" htmlFor="artwork-count">
              <Select id="artwork-count" name="count" defaultValue="1">
                {[1, 2, 3, 4].map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Button type="submit" variant="primary" disabled={pending}>
            <Wand2 size={14} aria-hidden="true" />
            {pending ? 'Generating…' : 'Generate'}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function OverlayForm({
  requestId,
  shortlist,
  defaultStudioName,
}: {
  requestId: string;
  shortlist: ShortlistItemView[];
  defaultStudioName: string;
}) {
  const [state, action, pending] = useActionState(renderShortlistOverlay, IDLE);
  const [assetId, setAssetId] = useState(shortlist[0]?.assetId ?? '');

  if (shortlist.length === 0) {
    return (
      <Card>
        <CardHeader
          title="Overlay text on a shortlisted photo"
          description="Needs at least one photo in this brief's shortlist."
        />
        <CardBody className="text-sm text-muted">
          Run a brief with results first.
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Overlay text on a shortlisted photo"
        description="The same compositor the ads module uses, applied to a photo this brief already found."
      />
      <CardBody className="space-y-4">
        {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
        {state.message ? (
          <p role="status" className="text-sm text-success">
            {state.message}
          </p>
        ) : null}

        <form action={action} className="space-y-4">
          <input type="hidden" name="requestId" value={requestId} />

          <Field label="Photograph" htmlFor="overlay-asset">
            <Select
              id="overlay-asset"
              name="assetId"
              value={assetId}
              onChange={(event) => setAssetId(event.target.value)}
            >
              {shortlist.map((item) => (
                <option key={item.assetId} value={item.assetId}>
                  {item.filename}
                </option>
              ))}
            </Select>
          </Field>

          <div className="relative aspect-square max-h-40 w-40 overflow-hidden rounded-md bg-surface-raised">
            {shortlist.find((item) => item.assetId === assetId)?.url ? (
              <Image
                src={shortlist.find((item) => item.assetId === assetId)!.url!}
                alt=""
                fill
                sizes="160px"
                className="object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-faint">
                <ImageOff size={18} aria-hidden="true" />
              </span>
            )}
          </div>

          <Field label="Size" htmlFor="overlay-size">
            <Select id="overlay-size" name="size" defaultValue="instagram_square">
              {AD_SIZE_KEYS.map((key: AdSizeKey) => (
                <option key={key} value={key}>
                  {AD_SIZES[key].label}
                </option>
              ))}
              <option value={CUSTOM_SIZE}>Custom…</option>
            </Select>
          </Field>

          <Field label="Headline" htmlFor="overlay-headline">
            <Input id="overlay-headline" name="headline" maxLength={120} />
          </Field>
          <Field label="Supporting line" htmlFor="overlay-subline" hint="Optional.">
            <Input id="overlay-subline" name="subline" maxLength={160} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Call to action" htmlFor="overlay-cta" hint="Optional.">
              <Input id="overlay-cta" name="callToAction" maxLength={40} />
            </Field>
            <Field label="Studio name" htmlFor="overlay-studio">
              <Input id="overlay-studio" name="studioName" defaultValue={defaultStudioName} maxLength={60} />
            </Field>
          </div>

          <input type="hidden" name="position" value="bottom" />
          <input type="hidden" name="scrim" value="0.55" />

          <Button type="submit" variant="primary" disabled={pending}>
            <Wand2 size={14} aria-hidden="true" />
            {pending ? 'Rendering…' : 'Render'}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
