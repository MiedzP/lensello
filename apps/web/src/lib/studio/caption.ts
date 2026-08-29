import type { ShootType } from '@lensello/core';
import { buildAssetAnalysisPrompt } from '@lensello/core/ai';
import { AiError, generateJson, isAiConfigured } from '@/lib/ai';
import type { Session } from '@/lib/auth';
import type { TablesInsert } from '@/lib/db.types';
import { isLabelKind, isUuid, type LabelKind } from './constants';
import { asLabelSource } from '@/lib/validators';

/**
 * The captioning pass: writes `assets.ai_caption` and `asset_ai_labels`.
 *
 * Resumable and idempotent by construction, not by a separate progress table:
 *
 * - Each batch selects assets `where ai_captioned_at is null`, oldest first.
 *   An interrupted run leaves the next-oldest untouched row exactly where a
 *   fresh call will pick it up — there is nothing else to persist.
 * - Assets that already have `ai_captioned_at` are never re-selected by a
 *   plain batch call, so re-running the same batch (or the whole shoot) is a
 *   no-op past the point it reached last time.
 * - Labels are written through `partitionLabelsAgainstManual`, which never
 *   touches a row whose `source` is 'manual' — the one rule that must hold
 *   even when everything else about the pass reruns.
 */

type Db = Session['supabase'];

export interface ProposedLabel {
  label: string;
  kind: LabelKind;
  confidence: number;
}

export interface CaptionResult {
  caption: string;
  labels: ProposedLabel[];
}

export interface ExistingLabelRow {
  label: string;
  source: 'ai' | 'manual';
}

export interface LabelWritePlan {
  /** Rows safe to upsert with `source: 'ai'`. */
  toWrite: ProposedLabel[];
  /** Label text a human already corrected — left untouched. */
  preserved: string[];
}

/**
 * The manual-label-preservation rule, as a pure function.
 *
 * A photographer's correction outranks the model's next guess for the same
 * concept, forever — not just until the next captioning run. This is the one
 * piece of the captioning pass that must never regress, so it is isolated
 * here where it can be tested without a database.
 */
export function partitionLabelsAgainstManual(
  existing: readonly ExistingLabelRow[],
  proposed: readonly ProposedLabel[],
): LabelWritePlan {
  const manualLabelTexts = new Set(
    existing.filter((row) => row.source === 'manual').map((row) => normalizeLabel(row.label)),
  );

  const toWrite: ProposedLabel[] = [];
  const preserved: string[] = [];

  for (const label of proposed) {
    const normalized = normalizeLabel(label.label);
    if (normalized.length === 0) continue;

    if (manualLabelTexts.has(normalized)) {
      preserved.push(normalized);
      continue;
    }

    toWrite.push({ ...label, label: normalized });
  }

  return { toWrite, preserved };
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().slice(0, 60);
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

/**
 * Derives a caption and labels from metadata alone — the same information the
 * AI-enhanced path is grounded in, per `buildAssetAnalysisPrompt`'s doc
 * comment. This is what actually runs while `ANTHROPIC_API_KEY` is unset, so
 * it has to produce something genuinely usable, not a placeholder.
 */
export function heuristicCaption(asset: {
  filename: string;
  tags: readonly string[];
  altText: string | null;
  shootType: ShootType | null;
  shootTitle: string | null;
}): CaptionResult {
  const parts = [
    asset.shootTitle ? `From ${asset.shootTitle}` : null,
    asset.altText,
  ].filter((part): part is string => Boolean(part && part.trim().length > 0));

  const caption =
    parts.length > 0
      ? parts.join(' — ').slice(0, 140)
      : `Untitled frame (${asset.filename}).`;

  const labels: ProposedLabel[] = asset.tags
    .map((tag) => normalizeLabel(tag))
    .filter((label) => label.length > 0)
    .slice(0, 6)
    .map((label) => ({ label, kind: 'subject' as LabelKind, confidence: 0.4 }));

  if (asset.shootType) {
    labels.push({ label: asset.shootType, kind: 'scene', confidence: 0.5 });
  }

  return { caption, labels };
}

/** Loose validation of the model's reply. Anything unusable falls back to the heuristic. */
function sanitizeAiCaption(raw: unknown): CaptionResult | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const value = raw as Record<string, unknown>;

  const caption = typeof value.caption === 'string' ? value.caption.trim().slice(0, 200) : '';
  if (caption.length === 0) return null;

  const labels = Array.isArray(value.labels)
    ? value.labels
        .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
        .map((row) => ({
          label: typeof row.label === 'string' ? normalizeLabel(row.label) : '',
          kind: isLabelKind(row.kind) ? row.kind : 'subject',
          confidence: clampConfidence(typeof row.confidence === 'number' ? row.confidence : 0.6),
        }))
        .filter((row) => row.label.length > 0)
        .slice(0, 6)
    : [];

  return { caption, labels };
}

async function describeOneAsset(asset: {
  filename: string;
  tags: readonly string[];
  altText: string | null;
  shootType: ShootType | null;
  shootTitle: string | null;
}): Promise<CaptionResult> {
  if (isAiConfigured()) {
    try {
      const prompt = buildAssetAnalysisPrompt({
        filename: asset.filename,
        existingTags: asset.tags,
        existingAltText: asset.altText,
        shootType: asset.shootType,
        shootTitle: asset.shootTitle,
      });
      const raw = await generateJson<unknown>(prompt, { maxTokens: 400 });
      const sanitized = sanitizeAiCaption(raw);
      if (sanitized) return sanitized;
    } catch (cause) {
      if (!(cause instanceof AiError)) throw cause;
      // Fall through to the heuristic below.
    }
  }

  return heuristicCaption(asset);
}

export interface CaptionBatchResult {
  processed: number;
  remaining: number;
  labelsWritten: number;
  labelsPreserved: number;
}

/**
 * Processes up to `limit` un-captioned assets in one shoot.
 *
 * Call this again to continue — it always picks up the oldest un-captioned
 * asset first, so an interrupted run and a deliberate "process more" click
 * look identical to it.
 */
export async function runCaptioningBatch(
  supabase: Db,
  shootId: string,
  limit: number,
): Promise<CaptionBatchResult> {
  if (!isUuid(shootId)) {
    return { processed: 0, remaining: 0, labelsWritten: 0, labelsPreserved: 0 };
  }

  const { data: shoot } = await supabase
    .from('shoots')
    .select('title, type')
    .eq('id', shootId)
    .maybeSingle();

  const { data: pending, error } = await supabase
    .from('assets')
    .select('id, filename, tags, alt_text')
    .eq('shoot_id', shootId)
    .is('ai_captioned_at', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(`Could not load photos to caption: ${error.message}`);
  if (!pending || pending.length === 0) {
    return { processed: 0, remaining: 0, labelsWritten: 0, labelsPreserved: 0 };
  }

  let labelsWritten = 0;
  let labelsPreserved = 0;

  for (const asset of pending) {
    const result = await describeOneAsset({
      filename: asset.filename,
      tags: asset.tags,
      altText: asset.alt_text,
      shootType: (shoot?.type as ShootType | undefined) ?? null,
      shootTitle: shoot?.title ?? null,
    });

    const { data: existingRows } = await supabase
      .from('asset_ai_labels')
      .select('label, source')
      .eq('asset_id', asset.id);

    const validatedRows: ExistingLabelRow[] = (existingRows ?? []).map((row) => ({
      label: row.label,
      source: asLabelSource(row.source),
    }));

    const plan = partitionLabelsAgainstManual(validatedRows, result.labels);
    labelsPreserved += plan.preserved.length;

    if (plan.toWrite.length > 0) {
      const rows: TablesInsert<'asset_ai_labels'>[] = plan.toWrite.map((label) => ({
        asset_id: asset.id,
        label: label.label,
        kind: label.kind,
        confidence: clampConfidence(label.confidence),
        source: 'ai',
      }));

      const { error: labelsError } = await supabase
        .from('asset_ai_labels')
        .upsert(rows, { onConflict: 'asset_id,label' });

      if (!labelsError) labelsWritten += rows.length;
    }

    await supabase
      .from('assets')
      .update({ ai_caption: result.caption, ai_captioned_at: new Date().toISOString() })
      .eq('id', asset.id);
  }

  const { count: remaining } = await supabase
    .from('assets')
    .select('id', { count: 'exact', head: true })
    .eq('shoot_id', shootId)
    .is('ai_captioned_at', null);

  return {
    processed: pending.length,
    remaining: remaining ?? 0,
    labelsWritten,
    labelsPreserved,
  };
}

/** Per-shoot progress, for the "caption your library" panel. */
export async function getCaptionProgress(
  supabase: Db,
  shootId: string,
): Promise<{ total: number; captioned: number }> {
  if (!isUuid(shootId)) return { total: 0, captioned: 0 };

  const [total, captioned] = await Promise.all([
    supabase.from('assets').select('id', { count: 'exact', head: true }).eq('shoot_id', shootId),
    supabase
      .from('assets')
      .select('id', { count: 'exact', head: true })
      .eq('shoot_id', shootId)
      .not('ai_captioned_at', 'is', null),
  ]);

  return { total: total.count ?? 0, captioned: captioned.count ?? 0 };
}
