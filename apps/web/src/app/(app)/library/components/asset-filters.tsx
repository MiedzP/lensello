'use client';

import { useOptimistic, useTransition } from 'react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { Button, Field, Select } from '@/components/ui';
import {
  ASSET_SORTS,
  ASSET_SORT_LABELS,
  DEFAULT_ASSET_SORT,
  isAssetSort,
} from '@/lib/library/constants';
import type { AssetFilters } from '@/lib/library/queries';

const RATINGS = [1, 2, 3, 4, 5] as const;

const CLEARED: AssetFilters = {
  selectsOnly: false,
  tag: null,
  minRating: 0,
  sort: DEFAULT_ASSET_SORT,
};

/**
 * Grid filters for one shoot: selects only, minimum rating, tag, sort order.
 *
 * A GET form again, so "just the selects, 4 stars and up" is a URL the
 * photographer can send to a retoucher. `selects=1` drives the query that uses
 * the `assets_selects_idx` partial index.
 */
export function AssetFiltersForm({
  shootId,
  filters,
  tags,
  isFiltered,
}: {
  shootId: string;
  filters: AssetFilters;
  tags: string[];
  isFiltered: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useOptimistic(filters);
  const [, startTransition] = useTransition();
  const basePath = `/library/${shootId}`;

  function apply(next: AssetFilters) {
    const params = new URLSearchParams();
    if (next.selectsOnly) params.set('selects', '1');
    if (next.minRating > 0) params.set('rating', String(next.minRating));
    if (next.tag) params.set('tag', next.tag);
    if (next.sort !== DEFAULT_ASSET_SORT) params.set('sort', next.sort);

    const query = params.toString();

    startTransition(() => {
      setView(next);
      // Non-literal href: the documented cast for typed routes.
      router.replace((query ? `${basePath}?${query}` : basePath) as Route);
    });
  }

  return (
    <form
      action={basePath}
      method="get"
      onSubmit={(event) => {
        event.preventDefault();
        apply(view);
      }}
      className="mb-4 flex flex-wrap items-end gap-3"
    >
      <label className="flex h-9 items-center gap-2 rounded-md border border-strong bg-surface px-3 text-sm text-foreground">
        <input
          type="checkbox"
          name="selects"
          value="1"
          checked={view.selectsOnly}
          onChange={(event) => apply({ ...view, selectsOnly: event.target.checked })}
          className="size-4 accent-accent"
        />
        Selects only
      </label>

      <Field label="Minimum rating" htmlFor="filter-rating" className="w-40">
        <Select
          id="filter-rating"
          name="rating"
          value={view.minRating > 0 ? String(view.minRating) : ''}
          onChange={(event) =>
            apply({ ...view, minRating: Number.parseInt(event.target.value, 10) || 0 })
          }
        >
          <option value="">Any rating</option>
          {RATINGS.map((rating) => (
            <option key={rating} value={rating}>
              {rating}+ stars
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Tag" htmlFor="filter-tag" className="w-44">
        <Select
          id="filter-tag"
          name="tag"
          value={view.tag ?? ''}
          disabled={tags.length === 0}
          onChange={(event) => apply({ ...view, tag: event.target.value || null })}
        >
          <option value="">Any tag</option>
          {tags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Sort by" htmlFor="filter-asset-sort" className="w-44">
        <Select
          id="filter-asset-sort"
          name="sort"
          value={view.sort}
          onChange={(event) =>
            apply({
              ...view,
              sort: isAssetSort(event.target.value) ? event.target.value : DEFAULT_ASSET_SORT,
            })
          }
        >
          {ASSET_SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {ASSET_SORT_LABELS[sort]}
            </option>
          ))}
        </Select>
      </Field>

      <Button type="submit">Apply</Button>

      {isFiltered ? (
        <Button type="button" variant="ghost" onClick={() => apply(CLEARED)}>
          Clear filters
        </Button>
      ) : null}
    </form>
  );
}
