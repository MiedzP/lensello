import type { Metadata } from 'next';
import { Images } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { pluralize } from '@/lib/utils';
import {
  isShootFiltered,
  listClientOptions,
  listShoots,
  parseShootFilters,
} from '@/lib/library/queries';
import { NewShootForm } from './components/new-shoot-form';
import { ShootCard } from './components/shoot-card';
import { ShootFiltersForm } from './components/shoot-filters';

export const metadata: Metadata = { title: 'Library' };

/**
 * Shoots index.
 *
 * Filter and sort state lives entirely in `searchParams` (a Promise in Next 16),
 * so a filtered view is a shareable URL and the browser's history works.
 */
export default async function LibraryPage(props: PageProps<'/library'>) {
  const [{ supabase }, searchParams] = await Promise.all([
    requireUserOrRedirect(),
    props.searchParams,
  ]);

  const filters = parseShootFilters(searchParams);
  const [shoots, clients] = await Promise.all([
    listShoots(supabase, filters),
    listClientOptions(supabase),
  ]);

  const filtered = isShootFiltered(filters);

  return (
    <>
      <PageHeader
        title="Library"
        description="Every shoot in the studio, with its photos, selects, and tags."
      />

      <NewShootForm clients={clients} />

      <ShootFiltersForm filters={filters} isFiltered={filtered} />

      {shoots.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={<Images size={24} aria-hidden="true" />}
            title="No shoots match these filters"
            description="Try a different status or type, or clear the filters to see everything."
          />
        ) : (
          <EmptyState
            icon={<Images size={24} aria-hidden="true" />}
            title="No shoots yet"
            description="Create a shoot first — it is the container photos get uploaded into."
          />
        )
      ) : (
        <>
          <p className="mb-3 text-xs text-muted" aria-live="polite">
            {pluralize(shoots.length, 'shoot')}
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shoots.map((shoot) => (
              <li key={shoot.id} className="min-w-0">
                <ShootCard shoot={shoot} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
