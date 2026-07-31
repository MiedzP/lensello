'use client';

import { useId, useState } from 'react';
import Image from 'next/image';
import { ImageOff, Trash2, X } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Field,
  Input,
  Textarea,
} from '@/components/ui';
import { formatBytes, formatDate } from '@/lib/library/constants';
import type { AssetView } from '@/lib/library/queries';
import { StarRating } from './star-rating';

/**
 * Detail panel for one photo.
 *
 * Everything that does not belong on a dense grid tile lives here: a bigger
 * preview, the file facts, tags, cover, alt text, and delete.
 */
export function AssetPanel({
  asset,
  disabled,
  onClose,
  onRate,
  onToggleSelect,
  onSetCover,
  onAddTag,
  onRemoveTag,
  onSaveAltText,
  onDelete,
}: {
  asset: AssetView;
  disabled: boolean;
  onClose: () => void;
  onRate: (assetId: string, rating: number) => void;
  onToggleSelect: (assetId: string, isSelect: boolean) => void;
  onSetCover: (assetId: string) => void;
  onAddTag: (assetIds: string[], tag: string) => Promise<void>;
  onRemoveTag: (assetId: string, tag: string) => void;
  onSaveAltText: (assetId: string, altText: string) => Promise<void>;
  onDelete: (assetId: string) => void;
}) {
  const id = useId();
  const [altText, setAltText] = useState(asset.altText ?? '');
  const [tagDraft, setTagDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Note: the caller keys this component on `asset.id`, so switching photos
  // remounts it and the drafts above re-seed themselves. That is React's
  // intended answer to "reset state when a prop changes" — an effect that
  // called setState would cause a second render pass for every photo you click.

  const captured = formatDate(asset.capturedAt);
  const added = formatDate(asset.createdAt);
  const isAltDirty = altText.trim() !== (asset.altText ?? '');

  return (
    <Card className="sticky top-6 overflow-hidden">
      <CardHeader
        title={<span className="block truncate">{asset.filename}</span>}
        action={
          <Button variant="ghost" size="sm" aria-label="Close photo details" onClick={onClose}>
            <X size={16} aria-hidden="true" />
          </Button>
        }
      />

      <div className="relative aspect-4/3 w-full bg-surface-raised">
        {asset.url ? (
          <Image
            src={asset.url}
            alt={asset.altText ?? ''}
            fill
            quality={90}
            sizes="(min-width: 1024px) 420px, 100vw"
            className="object-contain"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-faint">
            <ImageOff size={22} aria-hidden="true" />
            <span className="text-xs">Preview unavailable</span>
          </div>
        )}
      </div>

      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StarRating
            value={asset.rating}
            disabled={disabled}
            label={`Rating for ${asset.filename}`}
            onRate={(rating) => onRate(asset.id, rating)}
          />
          <Button
            size="sm"
            variant={asset.isSelect ? 'primary' : 'secondary'}
            aria-pressed={asset.isSelect}
            disabled={disabled}
            onClick={() => onToggleSelect(asset.id, !asset.isSelect)}
          >
            {asset.isSelect ? 'Selected' : 'Mark as select'}
          </Button>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div>
            <dt className="text-faint">Dimensions</dt>
            <dd className="tabular-nums text-foreground">
              {asset.width && asset.height ? `${asset.width} × ${asset.height}` : 'Unknown'}
            </dd>
          </div>
          <div>
            <dt className="text-faint">File size</dt>
            <dd className="tabular-nums text-foreground">{formatBytes(asset.byteSize)}</dd>
          </div>
          <div>
            <dt className="text-faint">Captured</dt>
            <dd className="text-foreground">{captured ?? 'Unknown'}</dd>
          </div>
          <div>
            <dt className="text-faint">Added</dt>
            <dd className="text-foreground">{added ?? '—'}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-faint">Format</dt>
            <dd className="text-foreground">{asset.mimeType.replace('image/', '')}</dd>
          </div>
        </dl>

        <div>
          <p className="mb-1.5 text-sm font-medium text-foreground">Tags</p>
          {asset.tags.length > 0 ? (
            <ul className="mb-2 flex flex-wrap gap-1.5">
              {asset.tags.map((tag) => (
                <li key={tag}>
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-raised py-0.5 pr-1 pl-2 text-xs text-muted">
                    {tag}
                    <button
                      type="button"
                      disabled={disabled}
                      aria-label={`Remove tag ${tag}`}
                      onClick={() => onRemoveTag(asset.id, tag)}
                      className="rounded-full p-0.5 hover:bg-surface-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <X size={11} aria-hidden="true" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-2 text-xs text-faint">No tags yet.</p>
          )}

          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const tag = tagDraft.trim();
              if (tag.length === 0) return;
              void onAddTag([asset.id], tag).then(() => setTagDraft(''));
            }}
          >
            <label htmlFor={`${id}-tag`} className="sr-only">
              Add a tag to {asset.filename}
            </label>
            <Input
              id={`${id}-tag`}
              value={tagDraft}
              maxLength={32}
              placeholder="golden hour"
              disabled={disabled}
              onChange={(event) => setTagDraft(event.target.value)}
            />
            <Button type="submit" disabled={disabled || tagDraft.trim().length === 0}>
              Add
            </Button>
          </form>
        </div>

        <Field
          label="Alt text"
          htmlFor={`${id}-alt`}
          hint="Written by hand. Used for accessibility and as grounding for caption generation."
        >
          <Textarea
            id={`${id}-alt`}
            value={altText}
            maxLength={500}
            disabled={disabled}
            placeholder="Bride laughing on the church steps, late afternoon light."
            onChange={(event) => setAltText(event.target.value)}
          />
        </Field>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            disabled={disabled || !isAltDirty}
            onClick={() => void onSaveAltText(asset.id, altText)}
          >
            Save alt text
          </Button>
          {isAltDirty ? (
            <Button size="sm" variant="ghost" onClick={() => setAltText(asset.altText ?? '')}>
              Revert
            </Button>
          ) : (
            <Badge tone={asset.altText ? 'success' : 'neutral'}>
              {asset.altText ? 'Described' : 'No alt text'}
            </Badge>
          )}
        </div>
      </CardBody>

      <CardFooter className="justify-between">
        <Button
          size="sm"
          disabled={disabled || asset.isCover}
          onClick={() => onSetCover(asset.id)}
        >
          {asset.isCover ? 'Shoot cover' : 'Set as cover'}
        </Button>

        {confirmDelete ? (
          <span className="flex items-center gap-2">
            <span className="text-xs text-muted">Delete permanently?</span>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
              No
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={disabled}
              onClick={() => onDelete(asset.id)}
            >
              Delete
            </Button>
          </span>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={14} aria-hidden="true" />
            Delete
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
