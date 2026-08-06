'use client';

import { useActionState, useState } from 'react';
import Image from 'next/image';
import { Download, Save, Wand2 } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorNote,
  Field,
  Input,
  Select,
} from '@/components/ui';
import {
  AD_SIZES,
  AD_SIZE_KEYS,
  composeBlock,
  layoutFor,
  type AdSizeKey,
  type CreativeInput,
  type TextPosition,
} from '@/lib/creative/spec';
import { renderAdCreative } from './actions';
import { CREATIVE_IDLE } from './creative-state';

export interface PickerPhoto {
  id: string;
  url: string;
  shootTitle: string;
}

/**
 * Live preview in CSS, final render in sharp.
 *
 * Both derive every position from `layoutFor`, so the design on screen is the
 * design in the file. A canvas preview would have been closer still, but the
 * photographs are cross-origin signed URLs and drawing one to a canvas taints
 * it — the export would break rather than the preview.
 */
export function CreativeStudio({
  photos,
  defaultStudioName,
}: {
  photos: PickerPhoto[];
  defaultStudioName: string;
}) {
  const [state, action, pending] = useActionState(renderAdCreative, CREATIVE_IDLE);

  const [assetId, setAssetId] = useState(photos[0]?.id ?? '');
  const [size, setSize] = useState<AdSizeKey>('instagram_square');
  const [headline, setHeadline] = useState('Autumn dates still open');
  const [subline, setSubline] = useState('');
  const [callToAction, setCallToAction] = useState('Check your date');
  const [studioName, setStudioName] = useState(defaultStudioName);
  const [position, setPosition] = useState<TextPosition>('bottom');
  const [scrim, setScrim] = useState(0.55);

  const selected = photos.find((photo) => photo.id === assetId) ?? photos[0];

  const input: CreativeInput = {
    size,
    headline,
    subline,
    callToAction,
    studioName,
    position,
    scrim,
  };
  const layout = layoutFor(input);
  const block = composeBlock(input);

  // The preview is a scaled copy of the real canvas, so every pixel value from
  // composeBlock is multiplied by one ratio. Anything computed independently
  // here would be a second source of truth, which is the bug this replaced.
  const previewWidth = 360;
  const previewHeight = (layout.height / layout.width) * previewWidth;
  const scale = previewWidth / layout.width;
  const px = (canvasPx: number) => canvasPx * scale;


  if (photos.length === 0) {
    return (
      <Card>
        <CardBody className="text-sm text-muted">
          There are no photographs in the library yet. Upload some to a shoot and
          you can build ad creative from them here.
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      <Card>
        <CardHeader
          title="Creative"
          description="Pick a photograph and lay your headline over it. The preview matches the exported file."
        />
        <CardBody className="space-y-4">
          {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
          {state.message ? (
            <p role="status" className="text-sm text-success">
              {state.message}
            </p>
          ) : null}

          <form action={action} className="space-y-4">
            <input type="hidden" name="assetId" value={assetId} />
            <input type="hidden" name="scrim" value={scrim} />
            <input type="hidden" name="position" value={position} />

            <div>
              <span className="block text-sm font-medium text-foreground">Photograph</span>
              <div className="mt-2 grid max-h-56 grid-cols-4 gap-2 overflow-y-auto rounded-md border border-subtle p-2 sm:grid-cols-6">
                {photos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setAssetId(photo.id)}
                    aria-pressed={photo.id === assetId}
                    title={photo.shootTitle}
                    className={
                      photo.id === assetId
                        ? 'relative aspect-square overflow-hidden rounded ring-2 ring-accent'
                        : 'relative aspect-square overflow-hidden rounded opacity-70 transition-opacity hover:opacity-100'
                    }
                  >
                    <Image
                      src={photo.url}
                      alt=""
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Size" htmlFor="creative-size">
                <Select
                  id="creative-size"
                  name="size"
                  value={size}
                  onChange={(event) => setSize(event.target.value as AdSizeKey)}
                >
                  {AD_SIZE_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {AD_SIZES[key].label} · {AD_SIZES[key].width}×{AD_SIZES[key].height}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Text position" htmlFor="creative-position">
                <Select
                  id="creative-position"
                  value={position}
                  onChange={(event) => setPosition(event.target.value as TextPosition)}
                >
                  <option value="bottom">Bottom</option>
                  <option value="centre">Centre</option>
                </Select>
              </Field>
            </div>

            <Field label="Headline" htmlFor="creative-headline">
              <Input
                id="creative-headline"
                name="headline"
                value={headline}
                maxLength={120}
                onChange={(event) => setHeadline(event.target.value)}
              />
            </Field>

            <Field label="Supporting line" htmlFor="creative-subline" hint="Optional.">
              <Input
                id="creative-subline"
                name="subline"
                value={subline}
                maxLength={160}
                onChange={(event) => setSubline(event.target.value)}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Call to action" htmlFor="creative-cta" hint="Leave blank to omit.">
                <Input
                  id="creative-cta"
                  name="callToAction"
                  value={callToAction}
                  maxLength={40}
                  onChange={(event) => setCallToAction(event.target.value)}
                />
              </Field>

              <Field label="Studio name" htmlFor="creative-studio">
                <Input
                  id="creative-studio"
                  name="studioName"
                  value={studioName}
                  maxLength={60}
                  onChange={(event) => setStudioName(event.target.value)}
                />
              </Field>
            </div>

            <Field
              label={`Darkening behind the text — ${Math.round(scrim * 100)}%`}
              htmlFor="creative-scrim"
              hint="Enough that the words stay readable on a bright photograph."
            >
              <input
                id="creative-scrim"
                type="range"
                min={0}
                max={0.9}
                step={0.05}
                value={scrim}
                onChange={(event) => setScrim(Number(event.target.value))}
                className="w-full accent-accent"
              />
            </Field>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="primary" disabled={pending}>
                <Wand2 size={14} aria-hidden="true" />
                {pending ? 'Rendering…' : 'Render'}
              </Button>

              <Button type="submit" name="save" value="1" disabled={pending}>
                <Save size={14} aria-hidden="true" />
                Render and save to the shoot
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <div className="space-y-4 lg:sticky lg:top-8 lg:self-start">
        <Card>
          <CardHeader title="Preview" description="Scaled down; the export is full size." />
          <CardBody>
            <div
              className="relative mx-auto overflow-hidden rounded-md bg-surface-raised"
              style={{ width: previewWidth, height: previewHeight }}
            >
              {selected ? (
                /* A plain img, not next/image: the preview must cover-crop
                   exactly as sharp will, and optimisation is pointless on a
                   360px box. */
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selected.url}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : null}

              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to bottom, rgba(0,0,0,0) ${block.scrimStart * 100}%, rgba(0,0,0,${layout.scrimOpacity}) 100%)`,
                }}
              />

              {studioName ? (
                <p
                  className="absolute font-semibold uppercase text-white"
                  style={{
                    left: px(block.padPx),
                    top: px(block.studioBaseline - block.studioPx),
                    fontSize: px(block.studioPx),
                    lineHeight: 1,
                    letterSpacing: '0.15em',
                  }}
                >
                  {studioName}
                </p>
              ) : null}

              {/* Absolutely positioned from the same baselines the renderer
                  uses, rather than left to normal flow. Flow would drift from
                  the export the moment a line height differed. */}
              {block.headlineLines.map((line, index) => (
                <p
                  key={`h${index}`}
                  className="absolute font-bold text-white"
                  style={{
                    left: px(block.padPx),
                    right: px(block.padPx),
                    top: px(block.headlineBaselines[index]! - block.headlinePx),
                    fontSize: px(block.headlinePx),
                    lineHeight: 1,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {line}
                </p>
              ))}

              {block.sublineLines.map((line, index) => (
                <p
                  key={`s${index}`}
                  className="absolute text-white/90"
                  style={{
                    left: px(block.padPx),
                    right: px(block.padPx),
                    top: px(block.sublineBaselines[index]! - block.sublinePx),
                    fontSize: px(block.sublinePx),
                    lineHeight: 1,
                  }}
                >
                  {line}
                </p>
              ))}

              {callToAction && block.ctaTop !== null ? (
                <span
                  className="absolute inline-flex items-center justify-center rounded-full bg-white font-semibold text-black"
                  style={{
                    left: px(block.padPx),
                    top: px(block.ctaTop),
                    width: px(block.ctaWidth),
                    height: px(block.ctaHeight),
                    fontSize: px(block.ctaPx),
                  }}
                >
                  {callToAction}
                </span>
              ) : null}
            </div>
          </CardBody>
        </Card>

        {state.preview ? (
          <Card>
            <CardHeader title="Rendered" description="The actual exported file." />
            <CardBody className="space-y-3">
              {/* A data URL — there is nothing for the image optimiser to do. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={state.preview} alt="Rendered ad creative" className="w-full rounded-md" />
              <a
                href={state.preview}
                download={`lensello-${size}.png`}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-strong bg-surface px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
              >
                <Download size={14} aria-hidden="true" />
                Download PNG
              </a>
            </CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
