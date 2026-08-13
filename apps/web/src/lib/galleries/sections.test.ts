import { describe, expect, it } from 'vitest';
import { buildDisplaySections, type GallerySectionWithAssets } from './sections';
import type { GalleryPhoto } from './queries';

/**
 * `fine_art` and `story` are the only styles that render this, but getting it
 * wrong is invisible in normal use — a photograph silently missing from every
 * chapter looks identical to a photograph nobody took. That is exactly the
 * kind of bug a test has to catch, because a glance at the page won't.
 */

function photo(id: string): GalleryPhoto {
  return { id, url: `https://example.invalid/${id}`, filename: `${id}.jpg`, width: null, height: null, altText: null, isFavourite: false };
}

function section(
  id: string,
  title: string,
  assetIds: string[],
  overrides: Partial<GallerySectionWithAssets> = {},
): GallerySectionWithAssets {
  return { id, title, blurb: null, sortOrder: 0, assetIds, ...overrides };
}

describe('buildDisplaySections', () => {
  it('puts everything in one untitled bucket when no sections are configured', () => {
    const photos = [photo('a'), photo('b')];
    const result = buildDisplaySections(photos, []);

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBeNull();
    expect(result[0]!.title).toBeNull();
    expect(result[0]!.photos).toEqual(photos);
  });

  it('orders each section by its own asset order, not capture order', () => {
    const photos = [photo('a'), photo('b'), photo('c')];
    const result = buildDisplaySections(photos, [section('s1', 'Ceremony', ['c', 'a'])]);

    // 'b' belongs to no section, so it lands in the trailing catch-all —
    // the section under test is the first one.
    expect(result[0]!.title).toBe('Ceremony');
    expect(result[0]!.photos.map((p) => p.id)).toEqual(['c', 'a']);
  });

  it('lets one photograph appear in more than one section', () => {
    const photos = [photo('a'), photo('b')];
    const result = buildDisplaySections(photos, [
      section('s1', 'Ceremony', ['a']),
      section('s2', 'Portraits', ['a', 'b']),
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]!.photos.map((p) => p.id)).toEqual(['a']);
    expect(result[1]!.photos.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('gathers photographs in no section into a trailing "More photographs" bucket', () => {
    const photos = [photo('a'), photo('b'), photo('c')];
    const result = buildDisplaySections(photos, [section('s1', 'Ceremony', ['a'])]);

    expect(result).toHaveLength(2);
    expect(result[1]!.id).toBeNull();
    expect(result[1]!.title).toBe('More photographs');
    expect(result[1]!.photos.map((p) => p.id)).toEqual(['b', 'c']);
  });

  it('omits the leftover bucket when every photograph is sectioned', () => {
    const photos = [photo('a'), photo('b')];
    const result = buildDisplaySections(photos, [section('s1', 'Ceremony', ['a', 'b'])]);

    expect(result).toHaveLength(1);
  });

  it('drops a section whose assets no longer resolve, rather than rendering an empty chapter', () => {
    const photos = [photo('a')];
    const result = buildDisplaySections(photos, [
      section('s1', 'Ceremony', ['deleted-asset']),
      section('s2', 'Portraits', ['a']),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe('Portraits');
  });

  it('puts every photograph in "More photographs" when no configured section resolves', () => {
    const photos = [photo('a')];
    const result = buildDisplaySections(photos, [section('s1', 'Ceremony', ['gone'])]);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe('More photographs');
    expect(result[0]!.photos).toEqual(photos);
  });

  it('falls back to one untitled bucket for an empty gallery with sections configured', () => {
    const result = buildDisplaySections([], [section('s1', 'Ceremony', [])]);

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBeNull();
    expect(result[0]!.title).toBeNull();
    expect(result[0]!.photos).toEqual([]);
  });
});
