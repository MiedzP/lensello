import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUserOrRedirect } from '@/lib/auth';
import {
  getShoot,
  getShootCounts,
  isAssetFiltered,
  listAssets,
  listClientOptions,
  listShootTags,
  parseAssetFilters,
} from '@/lib/library/queries';
import { AssetFiltersForm } from '../components/asset-filters';
import { AssetWorkspace } from '../components/asset-workspace';
import { ShootHeader } from '../components/shoot-header';
import { UploadPanel } from '../components/upload-panel';

// Static: a per-shoot title would cost an extra read of a row this page has
// already fetched below, and metadata resolves before the page body.
export const metadata: Metadata = { title: 'Shoot · Library' };

/**
 * Shoot detail — the photo asset manager.
 *
 * `params` and `searchParams` are Promises in Next 16. Grid filters live in the
 * query string so "selects only, 4 stars and up" is a shareable URL, and the
 * selects filter maps onto the `assets_selects_idx` partial index.
 */
export default async function ShootPage(props: PageProps<'/library/[shootId]'>) {
  const [{ supabase }, params, searchParams] = await Promise.all([
    requireUserOrRedirect(),
    props.params,
    props.searchParams,
  ]);

  const { shootId } = params;
  const detail = await getShoot(supabase, shootId);
  if (!detail) notFound();

  const filters = parseAssetFilters(searchParams);

  const [assets, tags, counts, clients] = await Promise.all([
    listAssets(supabase, shootId, filters, detail.shoot.cover_asset_id),
    listShootTags(supabase, shootId),
    getShootCounts(supabase, shootId),
    listClientOptions(supabase),
  ]);

  return (
    <>
      <ShootHeader
        shoot={detail.shoot}
        clientName={detail.clientName}
        clients={clients}
        assetCount={counts.total}
        selectCount={counts.selects}
      />

      <UploadPanel shootId={shootId} />

      <AssetFiltersForm
        shootId={shootId}
        filters={filters}
        tags={tags}
        isFiltered={isAssetFiltered(filters)}
      />

      <AssetWorkspace
        shootId={shootId}
        assets={assets}
        isFiltered={isAssetFiltered(filters)}
        hasAnyAssets={counts.total > 0}
      />
    </>
  );
}
