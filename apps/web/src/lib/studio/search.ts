import type { InterpretedBrief, CandidateAsset, MatchSignal, RankedAsset } from './types';

/**
 * Scores and ranks candidate assets against an interpreted brief.
 *
 * Pure and synchronous on purpose: everything that decides *why* a photo
 * shows up has to be inspectable and testable without a database, because
 * "trust me" is exactly the failure mode this feature exists to avoid — every
 * ranked photo carries a `rationale` built from the same signals that scored
 * it, not a separate explanation bolted on afterwards.
 */

const WEIGHTS = {
  exactLabel: 6,
  partialLabel: 2,
  tag: 4,
  caption: 2,
  gallerySection: 3,
  isSelect: 1,
  rating: 0.4, // per star, so a 5-star frame edges out an unrated one on a tie
} as const;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/** Every signal that matches one candidate against the brief's labels. */
function collectSignals(interpreted: InterpretedBrief, candidate: CandidateAsset): MatchSignal[] {
  const signals: MatchSignal[] = [];
  const labels = interpreted.labels.map(normalize).filter((label) => label.length > 0);

  for (const label of labels) {
    const exact = candidate.labels.find((row) => normalize(row.label) === label);
    if (exact) {
      signals.push({
        kind: 'label',
        detail: `labelled "${exact.label}" (${Math.round(exact.confidence * 100)}% confidence)`,
        weight: WEIGHTS.exactLabel * exact.confidence,
      });
      continue;
    }

    const partial = candidate.labels.find(
      (row) => normalize(row.label).includes(label) || label.includes(normalize(row.label)),
    );
    if (partial) {
      signals.push({
        kind: 'label',
        detail: `labelled "${partial.label}", close to "${label}"`,
        weight: WEIGHTS.partialLabel * partial.confidence,
      });
    }
  }

  for (const label of labels) {
    const tag = candidate.tags.find((t) => normalize(t) === label || normalize(t).includes(label));
    if (tag) {
      signals.push({ kind: 'tag', detail: `tagged "${tag}"`, weight: WEIGHTS.tag });
    }
  }

  if (candidate.aiCaption) {
    const caption = normalize(candidate.aiCaption);
    const hit = labels.find((label) => caption.includes(label));
    if (hit) {
      signals.push({
        kind: 'caption',
        detail: `caption mentions "${hit}"`,
        weight: WEIGHTS.caption,
      });
    }
  }

  for (const title of candidate.gallerySectionTitles) {
    const normalizedTitle = normalize(title);
    const hit = labels.find((label) => normalizedTitle.includes(label));
    if (hit) {
      signals.push({
        kind: 'gallery_section',
        detail: `in the client gallery section "${title}"`,
        weight: WEIGHTS.gallerySection,
      });
    }
  }

  if (candidate.isSelect) {
    signals.push({
      kind: 'quality',
      detail: 'marked as a select',
      weight: WEIGHTS.isSelect,
    });
  }
  if (candidate.rating > 0) {
    signals.push({
      kind: 'quality',
      detail: `rated ${candidate.rating}★`,
      weight: WEIGHTS.rating * candidate.rating,
    });
  }

  return signals;
}

/** Turns the matched signals into the sentence the UI shows next to a photo. */
export function buildRationale(signals: readonly MatchSignal[]): string {
  const matchSignals = signals.filter((signal) => signal.kind !== 'quality');
  const qualitySignals = signals.filter((signal) => signal.kind === 'quality');

  if (matchSignals.length === 0) {
    return qualitySignals.length > 0
      ? `No direct match to the brief, but it is ${qualitySignals.map((s) => s.detail).join(' and ')}.`
      : 'No direct match to the brief.';
  }

  const parts = matchSignals.map((signal) => signal.detail);
  const quality = qualitySignals.map((signal) => signal.detail);
  const sentence = parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;

  return quality.length > 0
    ? `${capitalize(sentence)} — also ${quality.join(' and ')}.`
    : `${capitalize(sentence)}.`;
}

function capitalize(value: string): string {
  return value.length > 0 ? value[0]!.toUpperCase() + value.slice(1) : value;
}

/**
 * Scores every candidate, drops anything with no real match to the brief, and
 * returns the top `interpreted.count`, best first.
 *
 * A pure "quality" signal (select, rating) is not enough to appear on its
 * own — an unrelated 5-star portrait is not a match for "the groom's
 * speech" just because it is a good photo. At least one label, tag, caption,
 * or gallery-section signal is required.
 */
export function rankCandidates(
  interpreted: InterpretedBrief,
  candidates: readonly CandidateAsset[],
): RankedAsset[] {
  const ranked = candidates
    .map((candidate) => {
      const signals = collectSignals(interpreted, candidate);
      const hasRealMatch = signals.some((signal) => signal.kind !== 'quality');
      const score = signals.reduce((sum, signal) => sum + signal.weight, 0);
      return { candidate, signals, hasRealMatch, score };
    })
    .filter((entry) => entry.hasRealMatch)
    .sort((a, b) => b.score - a.score);

  return ranked.slice(0, interpreted.count).map((entry) => ({
    assetId: entry.candidate.assetId,
    score: entry.score,
    rationale: buildRationale(entry.signals),
    signals: entry.signals,
  }));
}
