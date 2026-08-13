import { describe, expect, it } from 'vitest';
import { buildRationale, rankCandidates } from './search';
import type { CandidateAsset, InterpretedBrief } from './types';

const brief: InterpretedBrief = {
  summary: "Photos of the groom's speech",
  labels: ['speech', 'groom'],
  shootType: 'wedding',
  count: 10,
  notes: null,
  method: 'heuristic',
};

function candidate(overrides: Partial<CandidateAsset>): CandidateAsset {
  return {
    assetId: 'asset-1',
    tags: [],
    aiCaption: null,
    labels: [],
    gallerySectionTitles: [],
    rating: 0,
    isSelect: false,
    ...overrides,
  };
}

describe('rankCandidates', () => {
  it('ranks an exact, high-confidence label match above a merely tagged photo', () => {
    const exactMatch = candidate({
      assetId: 'exact',
      labels: [{ label: 'speech', kind: 'moment', confidence: 0.95 }],
    });
    const taggedOnly = candidate({ assetId: 'tagged', tags: ['speech'] });

    const ranked = rankCandidates(brief, [taggedOnly, exactMatch]);

    expect(ranked[0]?.assetId).toBe('exact');
    expect(ranked.map((r) => r.assetId)).toContain('tagged');
  });

  it('excludes a photo with no real match to the brief, even a great photo', () => {
    const unrelated = candidate({
      assetId: 'unrelated',
      isSelect: true,
      rating: 5,
      tags: ['beach'],
    });

    const ranked = rankCandidates(brief, [unrelated]);
    expect(ranked).toHaveLength(0);
  });

  it('breaks a tie between two equal matches using rating and select status', () => {
    const plain = candidate({ assetId: 'plain', tags: ['speech'] });
    const selected = candidate({
      assetId: 'starred',
      tags: ['speech'],
      isSelect: true,
      rating: 5,
    });

    const ranked = rankCandidates(brief, [plain, selected]);
    expect(ranked[0]?.assetId).toBe('starred');
  });

  it('respects the requested count', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      candidate({ assetId: `a${i}`, tags: ['speech'] }),
    );
    const ranked = rankCandidates({ ...brief, count: 3 }, many);
    expect(ranked).toHaveLength(3);
  });

  it('matches a label loosely when it is a close but not exact fit', () => {
    const closeMatch = candidate({
      assetId: 'close',
      labels: [{ label: 'best man speech', kind: 'moment', confidence: 0.8 }],
    });
    const ranked = rankCandidates(brief, [closeMatch]);
    expect(ranked).toHaveLength(1);
  });

  it('every ranked photo carries a non-empty rationale mentioning what matched', () => {
    const exactMatch = candidate({
      assetId: 'exact',
      labels: [{ label: 'speech', kind: 'moment', confidence: 0.9 }],
    });
    const [result] = rankCandidates(brief, [exactMatch]);
    expect(result?.rationale.length).toBeGreaterThan(0);
    expect(result?.rationale.toLowerCase()).toContain('speech');
  });
});

describe('buildRationale', () => {
  it('reports plainly when nothing matched', () => {
    expect(buildRationale([])).toMatch(/no direct match/i);
  });

  it('joins multiple signals into one readable sentence', () => {
    const rationale = buildRationale([
      { kind: 'label', detail: 'labelled "speech"', weight: 6 },
      { kind: 'tag', detail: 'tagged "reception"', weight: 4 },
    ]);
    expect(rationale).toMatch(/labelled "speech"/i);
    expect(rationale).toContain('tagged "reception"');
    expect(rationale).toContain('and');
  });
});
