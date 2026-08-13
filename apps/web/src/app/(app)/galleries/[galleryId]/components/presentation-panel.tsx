'use client';

import { useActionState, useState } from 'react';
import Image from 'next/image';
import { Button, Card, CardBody, CardHeader, ErrorNote, Field, Input, Select } from '@/components/ui';
import { cn } from '@/lib/utils';
import { DISPLAY_STYLE_INFO, DISPLAY_STYLES, type DisplayStyle } from '@/lib/galleries/queries';
import { updatePresentation } from '../actions';
import { GALLERY_ADMIN_IDLE } from '../admin-state';

export interface CoverThumb {
  id: string;
  filename: string;
  thumbUrl: string | null;
}

export function PresentationPanel({
  galleryId,
  displayStyle,
  accentColor,
  coverAssetId,
  assets,
}: {
  galleryId: string;
  displayStyle: DisplayStyle;
  accentColor: string | null;
  coverAssetId: string | null;
  assets: CoverThumb[];
}) {
  const [state, action, pending] = useActionState(updatePresentation, GALLERY_ADMIN_IDLE);
  const [style, setStyle] = useState<DisplayStyle>(displayStyle);
  const [selectedCover, setSelectedCover] = useState(coverAssetId ?? '');

  return (
    <Card>
      <CardHeader
        title="Presentation"
        description="How this gallery looks and feels to the client — the client can preview other styles for themselves, but this is what it opens with."
      />
      <CardBody className="space-y-5">
        {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
        {state.message ? (
          <p role="status" className="text-sm text-success">
            {state.message}
          </p>
        ) : null}

        <form action={action} className="space-y-5">
          <input type="hidden" name="galleryId" value={galleryId} />
          <input type="hidden" name="coverAssetId" value={selectedCover} />

          <Field
            label="Display style"
            htmlFor="displayStyle"
            hint={DISPLAY_STYLE_INFO[style].description}
          >
            <Select
              id="displayStyle"
              name="displayStyle"
              value={style}
              onChange={(event) => setStyle(event.target.value as DisplayStyle)}
            >
              {DISPLAY_STYLES.map((option) => (
                <option key={option} value={option}>
                  {DISPLAY_STYLE_INFO[option].label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Accent colour"
            htmlFor="accentColor"
            hint="Optional. A hex colour, e.g. #4a6b8a — used for chapter headings in the fine art and story styles."
          >
            <Input
              id="accentColor"
              name="accentColor"
              defaultValue={accentColor ?? ''}
              placeholder="#4a6b8a"
              maxLength={7}
            />
          </Field>

          {assets.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-foreground">Cover photograph</p>
              <p className="mt-0.5 mb-2 text-xs text-muted">
                Shown on the client portal dashboard. Defaults to the first photograph in the shoot.
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedCover('')}
                  className={cn(
                    'flex h-16 w-16 shrink-0 items-center justify-center rounded-md border text-center text-[10px] text-muted',
                    selectedCover === '' ? 'border-accent text-accent' : 'border-subtle',
                  )}
                >
                  Auto
                </button>
                {assets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => setSelectedCover(asset.id)}
                    title={asset.filename}
                    className={cn(
                      'relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-surface-raised ring-2',
                      asset.id === selectedCover ? 'ring-accent' : 'ring-transparent',
                    )}
                  >
                    {asset.thumbUrl ? (
                      <Image src={asset.thumbUrl} alt={asset.filename} fill sizes="64px" className="object-cover" />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Saving…' : 'Save presentation'}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
