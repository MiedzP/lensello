/**
 * Grouping a gallery's photographs into named sections.
 *
 * "Ceremony", "Speeches", "Portraits" — the same grouping that lets the studio
 * ask for "the groom's speech" later without re-tagging anything, and the
 * chapter structure that the `fine_art` and `story` display styles render.
 * `mosaic`, `contact_sheet` and `film_strip` deliberately ignore this: they are
 * the dense, flat experiences, and a blurb-and-heading between two thumbnails
 * would just break their rhythm.
 *
 * Read by both staff (their own Supabase client, RLS-scoped) and the public
 * gallery and portal routes (the service role), so every function here takes
 * a plain `SupabaseClient<Database>` rather than the admin-only alias used in
 * `queries.ts`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db.types';
import type { GalleryPhoto } from './queries';

type Db = SupabaseClient<Database>;

export interface GallerySectionWithAssets {
  id: string;
  title: string;
  blurb: string | null;
  sortOrder: number;
  /** Ordered by the section's own `sort_order`, not capture time. */
  assetIds: string[];
}

/** A gallery's sections, each with its ordered asset ids. Empty when none exist. */
export async function listGallerySections(
  db: Db,
  galleryId: string,
): Promise<GallerySectionWithAssets[]> {
  const { data: sections } = await db
    .from('gallery_sections')
    .select('id, title, blurb, sort_order')
    .eq('gallery_id', galleryId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (!sections?.length) return [];

  const sectionIds = sections.map((section) => section.id);

  const { data: links } = await db
    .from('gallery_section_assets')
    .select('section_id, asset_id, sort_order')
    .in('section_id', sectionIds)
    .order('sort_order', { ascending: true });

  const assetIdsBySection = new Map<string, string[]>();
  for (const link of links ?? []) {
    const list = assetIdsBySection.get(link.section_id) ?? [];
    list.push(link.asset_id);
    assetIdsBySection.set(link.section_id, list);
  }

  return sections.map((section) => ({
    id: section.id,
    title: section.title,
    blurb: section.blurb,
    sortOrder: section.sort_order,
    assetIds: assetIdsBySection.get(section.id) ?? [],
  }));
}

export interface DisplaySection {
  /** Null for an implicit bucket — "no sections configured" or "leftovers". */
  id: string | null;
  title: string | null;
  blurb: string | null;
  photos: GalleryPhoto[];
}

/**
 * Arranges a gallery's photographs into the chapters `fine_art` and `story`
 * render.
 *
 * A photograph can sit in more than one section (a portrait taken during the
 * speeches belongs to both), so this does not partition `photos` — it looks
 * each section's assets up in `photos` and lets duplicates stand. Anything left
 * over after every named section is gathered lands in one trailing "More
 * photographs" bucket, so nothing outside the sections the studio configured
 * is silently dropped from the client's view.
 */
export function buildDisplaySections(
  photos: GalleryPhoto[],
  sections: GallerySectionWithAssets[],
): DisplaySection[] {
  if (sections.length === 0) {
    return [{ id: null, title: null, blurb: null, photos }];
  }

  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  const used = new Set<string>();

  const named: DisplaySection[] = sections
    .map((section) => {
      const sectionPhotos = section.assetIds.flatMap((assetId) => {
        const photo = byId.get(assetId);
        if (!photo) return [];
        used.add(assetId);
        return [photo];
      });
      return { id: section.id, title: section.title, blurb: section.blurb, photos: sectionPhotos };
    })
    // A section with nothing resolvable in it (every asset removed from the
    // shoot, say) would otherwise render as an empty chapter heading.
    .filter((section) => section.photos.length > 0);

  const leftover = photos.filter((photo) => !used.has(photo.id));
  if (leftover.length > 0) {
    named.push({ id: null, title: 'More photographs', blurb: null, photos: leftover });
  }

  return named.length > 0 ? named : [{ id: null, title: null, blurb: null, photos }];
}
