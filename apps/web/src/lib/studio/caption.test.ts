import { describe, expect, it } from 'vitest';
import { heuristicCaption, partitionLabelsAgainstManual } from './caption';

describe('partitionLabelsAgainstManual', () => {
  it('never rewrites a label a human corrected, even when the model proposes the same text', () => {
    const existing = [{ label: 'speech', source: 'manual' as const }];
    const proposed = [{ label: 'speech', kind: 'moment' as const, confidence: 0.9 }];

    const plan = partitionLabelsAgainstManual(existing, proposed);

    expect(plan.toWrite).toHaveLength(0);
    expect(plan.preserved).toEqual(['speech']);
  });

  it('is case- and whitespace-insensitive when checking for a manual match', () => {
    const existing = [{ label: 'Speech', source: 'manual' as const }];
    const proposed = [{ label: '  speech  ', kind: 'moment' as const, confidence: 0.9 }];

    const plan = partitionLabelsAgainstManual(existing, proposed);

    expect(plan.toWrite).toHaveLength(0);
    expect(plan.preserved).toEqual(['speech']);
  });

  it('writes a proposed label that has no manual row under that text', () => {
    const existing = [{ label: 'speech', source: 'manual' as const }];
    const proposed = [{ label: 'confetti', kind: 'object' as const, confidence: 0.7 }];

    const plan = partitionLabelsAgainstManual(existing, proposed);

    expect(plan.toWrite).toEqual([{ label: 'confetti', kind: 'object', confidence: 0.7 }]);
    expect(plan.preserved).toHaveLength(0);
  });

  it('overwrites a previous AI guess for the same label — only manual rows are protected', () => {
    const existing = [{ label: 'speech', source: 'ai' as const }];
    const proposed = [{ label: 'speech', kind: 'moment' as const, confidence: 0.95 }];

    const plan = partitionLabelsAgainstManual(existing, proposed);

    expect(plan.toWrite).toHaveLength(1);
    expect(plan.preserved).toHaveLength(0);
  });

  it('a manual correction under a different label leaves the new AI label untouched', () => {
    // The photographer corrected "speech" to "toast"; a rerun proposing
    // "speech" again for the same asset must still not be silently accepted
    // as if nothing happened — it writes, because "speech" itself was never
    // the manual row. The UI is expected to show both until someone reviews it.
    const existing = [{ label: 'toast', source: 'manual' as const }];
    const proposed = [{ label: 'speech', kind: 'moment' as const, confidence: 0.9 }];

    const plan = partitionLabelsAgainstManual(existing, proposed);

    expect(plan.toWrite).toEqual([{ label: 'speech', kind: 'moment', confidence: 0.9 }]);
  });

  it('drops an empty proposed label rather than writing junk', () => {
    const plan = partitionLabelsAgainstManual([], [{ label: '   ', kind: 'subject', confidence: 0.5 }]);
    expect(plan.toWrite).toHaveLength(0);
    expect(plan.preserved).toHaveLength(0);
  });
});

describe('heuristicCaption', () => {
  it('produces a caption and labels from tags alone, without a model', () => {
    const result = heuristicCaption({
      filename: 'IMG_001.jpg',
      tags: ['reception', 'speech'],
      altText: null,
      shootType: 'wedding',
      shootTitle: 'Smith wedding',
    });

    expect(result.caption.length).toBeGreaterThan(0);
    expect(result.labels.map((l) => l.label)).toEqual(
      expect.arrayContaining(['reception', 'speech', 'wedding']),
    );
  });

  it('never throws when there is no metadata at all', () => {
    const result = heuristicCaption({
      filename: 'IMG_002.jpg',
      tags: [],
      altText: null,
      shootType: null,
      shootTitle: null,
    });

    expect(result.caption.length).toBeGreaterThan(0);
  });
});
