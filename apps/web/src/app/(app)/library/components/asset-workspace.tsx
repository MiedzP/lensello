'use client';

import { useCallback, useId, useMemo, useState, useTransition } from 'react';
import { ImageOff } from 'lucide-react';
import { Button, EmptyState, ErrorNote, Input } from '@/components/ui';
import { pluralize } from '@/lib/utils';
import type { AssetView } from '@/lib/library/queries';
import {
  addAssetsTag,
  deleteAsset,
  removeAssetsTag,
  setAssetsRating,
  setAssetsSelect,
  setShootCover,
  updateAssetAltText,
  type ActionResult,
} from '../actions';
import { AssetPanel } from './asset-panel';
import { AssetTile } from './asset-tile';
import { StarRating } from './star-rating';

/**
 * The photo grid, its multi-select, and the detail panel.
 *
 * One Client Component owns all three because they share exactly one piece of
 * state — which photos are checked — and splitting them would mean lifting that
 * into a context for no gain. Filtering and sorting stay on the server, in the
 * URL.
 *
 * Every mutation is a Server Action; each one revalidates this path, so the
 * grid re-renders from fresh server data while the selection survives.
 */
export function AssetWorkspace({
  shootId,
  assets,
  isFiltered,
  hasAnyAssets,
}: {
  shootId: string;
  assets: AssetView[];
  isFiltered: boolean;
  hasAnyAssets: boolean;
}) {
  const id = useId();
  const [rawCheckedIds, setCheckedIds] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bulkTag, setBulkTag] = useState('');
  const [pending, startTransition] = useTransition();

  const visibleIds = useMemo(() => assets.map((asset) => asset.id), [assets]);

  // Photos leave the grid when they are deleted or filtered out. Rather than
  // pruning the stored selection in an effect (a second render pass on every
  // server revalidation), derive the usable selection during render — a bulk
  // action then cannot target something no longer on screen.
  const checkedIds = useMemo(
    () => rawCheckedIds.filter((assetId) => visibleIds.includes(assetId)),
    [rawCheckedIds, visibleIds],
  );

  const openAsset = assets.find((asset) => asset.id === openId) ?? null;

  /** Runs a Server Action and surfaces its error inline. */
  const run = useCallback(
    (action: () => Promise<ActionResult>) =>
      new Promise<void>((resolve) => {
        startTransition(async () => {
          setError(null);
          try {
            const result = await action();
            if (!result.ok) setError(result.error);
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'That change did not save.');
          }
          resolve();
        });
      }),
    [],
  );

  const toggleCheck = useCallback((assetId: string, checked: boolean) => {
    setCheckedIds((current) =>
      checked
        ? current.includes(assetId)
          ? current
          : [...current, assetId]
        : current.filter((value) => value !== assetId),
    );
  }, []);

  const rate = useCallback(
    (assetId: string, rating: number) => void run(() => setAssetsRating(shootId, [assetId], rating)),
    [run, shootId],
  );

  const toggleSelect = useCallback(
    (assetId: string, isSelect: boolean) =>
      void run(() => setAssetsSelect(shootId, [assetId], isSelect)),
    [run, shootId],
  );

  const addTag = useCallback(
    (assetIds: string[], tag: string) => run(() => addAssetsTag(shootId, assetIds, tag)),
    [run, shootId],
  );

  const allChecked = checkedIds.length > 0 && checkedIds.length === assets.length;

  if (assets.length === 0) {
    return isFiltered ? (
      <EmptyState
        icon={<ImageOff size={22} aria-hidden="true" />}
        title="No photos match these filters"
        description="Loosen the rating, tag, or selects filter to see more of this shoot."
      />
    ) : (
      <EmptyState
        icon={<ImageOff size={22} aria-hidden="true" />}
        title={hasAnyAssets ? 'Nothing to show' : 'No photos in this shoot yet'}
        description="Add photos above. They upload straight to storage, then appear here."
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCheckedIds(allChecked ? [] : visibleIds)}
          >
            {allChecked ? 'Clear selection' : `Select all ${assets.length}`}
          </Button>
          <p className="text-xs text-muted" aria-live="polite">
            {checkedIds.length > 0
              ? `${pluralize(checkedIds.length, 'photo')} checked`
              : pluralize(assets.length, 'photo')}
          </p>
        </div>

        {checkedIds.length > 0 ? (
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-subtle bg-surface px-4 py-3">
            <span className="text-sm font-medium text-foreground">
              {pluralize(checkedIds.length, 'photo')} checked
            </span>

            <span className="flex items-center gap-2">
              <span className="text-xs text-muted">Rate</span>
              <StarRating
                value={0}
                disabled={pending}
                label="Set rating for checked photos"
                onRate={(rating) => void run(() => setAssetsRating(shootId, checkedIds, rating))}
              />
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => void run(() => setAssetsRating(shootId, checkedIds, 0))}
              >
                Clear
              </Button>
            </span>

            <span className="flex items-center gap-2">
              <Button
                size="sm"
                disabled={pending}
                onClick={() => void run(() => setAssetsSelect(shootId, checkedIds, true))}
              >
                Mark as selects
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => void run(() => setAssetsSelect(shootId, checkedIds, false))}
              >
                Unmark
              </Button>
            </span>

            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const tag = bulkTag.trim();
                if (tag.length === 0) return;
                void addTag(checkedIds, tag).then(() => setBulkTag(''));
              }}
            >
              <label htmlFor={`${id}-bulk-tag`} className="text-xs text-muted">
                Tag all
              </label>
              <Input
                id={`${id}-bulk-tag`}
                value={bulkTag}
                maxLength={32}
                placeholder="ceremony"
                disabled={pending}
                onChange={(event) => setBulkTag(event.target.value)}
                className="h-8 w-36"
              />
              <Button
                type="submit"
                size="sm"
                disabled={pending || bulkTag.trim().length === 0}
              >
                Add tag
              </Button>
            </form>

            <Button size="sm" variant="ghost" onClick={() => setCheckedIds([])}>
              Clear
            </Button>
          </div>
        ) : null}

        {error ? (
          <div className="mb-4">
            <ErrorNote>{error}</ErrorNote>
          </div>
        ) : null}

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {assets.map((asset) => (
            <li key={asset.id} className="min-w-0">
              <AssetTile
                asset={asset}
                isChecked={checkedIds.includes(asset.id)}
                isOpen={openId === asset.id}
                disabled={pending}
                onToggleCheck={toggleCheck}
                onOpen={setOpenId}
                onRate={rate}
                onToggleSelect={toggleSelect}
              />
            </li>
          ))}
        </ul>
      </div>

      <aside className="min-w-0" aria-label="Photo details">
        {openAsset ? (
          <AssetPanel
            // Remount on a different photo so its draft fields re-seed.
            key={openAsset.id}
            asset={openAsset}
            disabled={pending}
            onClose={() => setOpenId(null)}
            onRate={rate}
            onToggleSelect={toggleSelect}
            onSetCover={(assetId) => void run(() => setShootCover(shootId, assetId))}
            onAddTag={addTag}
            onRemoveTag={(assetId, tag) =>
              void run(() => removeAssetsTag(shootId, [assetId], tag))
            }
            onSaveAltText={(assetId, altText) =>
              run(() => updateAssetAltText(shootId, assetId, altText))
            }
            onDelete={(assetId) => {
              setOpenId(null);
              void run(() => deleteAsset(shootId, assetId));
            }}
          />
        ) : (
          <p className="rounded-lg border border-dashed border-strong px-4 py-6 text-center text-xs text-muted">
            Select a photo to see its details, tags, and alt text.
          </p>
        )}
      </aside>
    </div>
  );
}
