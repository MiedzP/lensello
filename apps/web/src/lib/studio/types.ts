import type { ShootType } from '@lensello/core';
import type { LabelKind } from './constants';

/**
 * The studio's reading of a plain-English brief.
 *
 * Stored verbatim in `studio_requests.interpreted` (jsonb) alongside the
 * untouched `prompt`, so a disappointing shortlist can be traced back to
 * either "the model misread this" or "the model read it fine, but the library
 * has nothing for it" — two different problems with two different fixes.
 *
 * Every field is a plain JSON-shaped value on purpose: this object is written
 * straight into a `jsonb` column.
 */
export interface InterpretedBrief {
  /** One-sentence restatement, shown back to the photographer for confirmation. */
  summary: string;
  /** Lowercase, single-concept search terms — the vocabulary `asset_ai_labels` uses. */
  labels: string[];
  shootType: ShootType | null;
  /** How many photos to shortlist. */
  count: number;
  notes: string | null;
  /** 'ai' when a configured model read the brief; 'heuristic' when it degraded. */
  method: 'ai' | 'heuristic';
}

/** One signal that made a candidate photo match the brief. Feeds the rationale. */
export interface MatchSignal {
  kind: 'label' | 'tag' | 'caption' | 'gallery_section' | 'quality';
  detail: string;
  /** 0-1. How much this signal should count toward the ranking. */
  weight: number;
}

/** Everything the ranker needs to know about one candidate asset. */
export interface CandidateAsset {
  assetId: string;
  tags: string[];
  aiCaption: string | null;
  labels: { label: string; kind: LabelKind; confidence: number }[];
  gallerySectionTitles: string[];
  rating: number;
  isSelect: boolean;
}

/** A candidate after scoring, ready to store as a `studio_shortlist` row. */
export interface RankedAsset {
  assetId: string;
  score: number;
  rationale: string;
  signals: MatchSignal[];
}

/** Renderable shortlist row for the UI: the ranking plus a signed photo URL. */
export interface ShortlistItemView {
  id: string;
  assetId: string;
  rank: number;
  rationale: string | null;
  score: number | null;
  decision: 'pending' | 'approved' | 'rejected';
  filename: string;
  altText: string | null;
  url: string | null;
}

/** Renderable generated-image row for the UI. */
export interface GeneratedImageView {
  id: string;
  prompt: string;
  provider: string;
  model: string | null;
  width: number | null;
  height: number | null;
  decision: 'pending' | 'approved' | 'rejected';
  assetId: string | null;
  createdAt: string;
  url: string | null;
}

/**
 * Reads `studio_requests.interpreted` back out for display.
 *
 * The column is untyped `jsonb` at the database boundary — this is the one
 * place that trusts its shape, and it trusts cautiously: anything missing or
 * malformed (an old row from before a field existed, a hand-edited row)
 * yields `null` rather than a rendering crash.
 */
export function parseInterpretedBrief(raw: unknown): InterpretedBrief | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const value = raw as Record<string, unknown>;

  if (typeof value.summary !== 'string') return null;
  if (!Array.isArray(value.labels)) return null;

  return {
    summary: value.summary,
    labels: value.labels.filter((label): label is string => typeof label === 'string'),
    shootType: typeof value.shootType === 'string' ? (value.shootType as ShootType) : null,
    count: typeof value.count === 'number' ? value.count : 0,
    notes: typeof value.notes === 'string' ? value.notes : null,
    method: value.method === 'ai' ? 'ai' : 'heuristic',
  };
}
