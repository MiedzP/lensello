import Link from 'next/link';
import Form from 'next/form';
import { AD_PLATFORMS, AD_STATUSES } from '@lensello/core';
import { Button, Select } from '@/components/ui';
import {
  AD_PLATFORM_LABELS,
  AD_SORT_KEYS,
  AD_SORT_LABELS,
  AD_STATUS_LABELS,
} from '@/lib/ads/constants';
// Aliased: the component below is also called AdFilters, and having the type and
// the component share a bare name in one file reads as a mistake.
import { hasActiveFilters, type AdFilters as Filters } from '@/lib/ads/schema';

/**
 * Status / platform / sort controls for /ads.
 *
 * A plain GET form, so the resulting view is a URL someone can bookmark or
 * paste into Slack — the whole reason the filters live in searchParams rather
 * than component state. `next/form` keeps that a client-side navigation instead
 * of a full document load, and it needs no `'use client'` here: submitting is
 * the browser's job, not React's.
 */
export function AdFilters({ filters }: { filters: Filters }) {
  const isFiltered = hasActiveFilters(filters);

  return (
    <Form action="/ads" className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <label htmlFor="filter-status" className="block text-xs font-medium text-muted">
          Status
        </label>
        <Select
          id="filter-status"
          name="status"
          defaultValue={filters.status ?? ''}
          className="w-40"
        >
          <option value="">All statuses</option>
          {AD_STATUSES.map((status) => (
            <option key={status} value={status}>
              {AD_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="filter-platform"
          className="block text-xs font-medium text-muted"
        >
          Platform
        </label>
        <Select
          id="filter-platform"
          name="platform"
          defaultValue={filters.platform ?? ''}
          className="w-40"
        >
          <option value="">All platforms</option>
          {AD_PLATFORMS.map((platform) => (
            <option key={platform} value={platform}>
              {AD_PLATFORM_LABELS[platform]}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="filter-sort" className="block text-xs font-medium text-muted">
          Sort by
        </label>
        <Select
          id="filter-sort"
          name="sort"
          defaultValue={filters.sort}
          className="w-32"
        >
          {AD_SORT_KEYS.map((key) => (
            <option key={key} value={key}>
              {AD_SORT_LABELS[key]}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="filter-dir" className="block text-xs font-medium text-muted">
          Order
        </label>
        <Select id="filter-dir" name="dir" defaultValue={filters.dir} className="w-36">
          <option value="desc">Highest first</option>
          <option value="asc">Lowest first</option>
        </Select>
      </div>

      <Button type="submit">Apply</Button>

      {isFiltered ? (
        <Link
          href="/ads"
          className="px-1 pb-2 text-sm text-accent hover:underline"
        >
          Clear filters
        </Link>
      ) : null}
    </Form>
  );
}
