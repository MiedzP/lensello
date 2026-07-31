'use client';

import { useOptimistic, useTransition } from 'react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { SHOOT_STATUSES, SHOOT_TYPES, SHOOT_TYPE_LABELS } from '@lensello/core';
import { Button, Field, Select } from '@/components/ui';
import {
  DEFAULT_SHOOT_SORT,
  SHOOT_SORTS,
  SHOOT_SORT_LABELS,
  SHOOT_STATUS_LABELS,
  isShootSort,
  isShootStatus,
  isShootType,
} from '@/lib/library/constants';
import type { ShootFilters } from '@/lib/library/queries';

/**
 * Filter + sort controls for the shoots index.
 *
 * The state of record is the URL, so a filtered view is shareable and the
 * browser's back button does the obvious thing. It is a real GET form, which
 * means it still works with JavaScript off; with JS the submit is intercepted
 * for a client-side navigation instead of a document load.
 *
 * The controls are driven by `useOptimistic` rather than `defaultValue`: the
 * select has to show the new choice the instant it is made, and then be
 * corrected by whatever the server actually rendered — including when another
 * control (Clear filters, or the back button) changes the filters underneath it.
 */
export function ShootFiltersForm({
  filters,
  isFiltered,
}: {
  filters: ShootFilters;
  isFiltered: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useOptimistic(filters);
  const [, startTransition] = useTransition();

  function apply(next: ShootFilters) {
    const params = new URLSearchParams();
    if (next.status) params.set('status', next.status);
    if (next.type) params.set('type', next.type);
    if (next.sort !== DEFAULT_SHOOT_SORT) params.set('sort', next.sort);

    const query = params.toString();

    startTransition(() => {
      setView(next);
      // Non-literal href: the documented cast for typed routes.
      router.replace((query ? `/library?${query}` : '/library') as Route);
    });
  }

  return (
    <form
      action="/library"
      method="get"
      onSubmit={(event) => {
        event.preventDefault();
        apply(view);
      }}
      className="mb-5 flex flex-wrap items-end gap-3"
    >
      <Field label="Status" htmlFor="filter-status" className="w-44">
        <Select
          id="filter-status"
          name="status"
          value={view.status ?? ''}
          onChange={(event) =>
            apply({
              ...view,
              status: isShootStatus(event.target.value) ? event.target.value : null,
            })
          }
        >
          <option value="">All statuses</option>
          {SHOOT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {SHOOT_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Type" htmlFor="filter-type" className="w-44">
        <Select
          id="filter-type"
          name="type"
          value={view.type ?? ''}
          onChange={(event) =>
            apply({
              ...view,
              type: isShootType(event.target.value) ? event.target.value : null,
            })
          }
        >
          <option value="">All types</option>
          {SHOOT_TYPES.map((type) => (
            <option key={type} value={type}>
              {SHOOT_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Sort by" htmlFor="filter-sort" className="w-56">
        <Select
          id="filter-sort"
          name="sort"
          value={view.sort}
          onChange={(event) =>
            apply({
              ...view,
              sort: isShootSort(event.target.value) ? event.target.value : DEFAULT_SHOOT_SORT,
            })
          }
        >
          {SHOOT_SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {SHOOT_SORT_LABELS[sort]}
            </option>
          ))}
        </Select>
      </Field>

      {/* The no-JS path: without the submit handler above, this is what applies
          the filters. Redundant once hydrated, which is better than required. */}
      <Button type="submit">Apply</Button>

      {isFiltered ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => apply({ status: null, type: null, sort: DEFAULT_SHOOT_SORT })}
        >
          Clear filters
        </Button>
      ) : null}
    </form>
  );
}
