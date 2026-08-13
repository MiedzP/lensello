import { SHOOT_TYPES, type ShootType } from '@lensello/core';
import { buildStudioInterpretPrompt } from '@lensello/core/ai';
import { AiError, generateJson, isAiConfigured } from '@/lib/ai';
import { clampShortlistSize, DEFAULT_SHORTLIST_SIZE } from './constants';
import type { InterpretedBrief } from './types';

/**
 * Turning "I want to create a post about the groom's speech" into a search.
 *
 * Two paths produce the same shape (`InterpretedBrief`), so the search and
 * ranking code downstream never has to know which one ran:
 *
 * - `interpretBrief` calls the model when `ANTHROPIC_API_KEY` is configured,
 *   and falls back to `heuristicInterpret` the moment that call fails for any
 *   reason — missing key, network error, or an unparseable reply. The brief
 *   box must never hard-fail because a model call hiccupped.
 * - `heuristicInterpret` is pure, synchronous, and always available. It is
 *   also what actually runs in this environment today, since
 *   `ANTHROPIC_API_KEY` is unset by default — so it has to be a real search
 *   strategy, not a stub.
 */

const STOPWORDS = new Set([
  'a', 'about', 'an', 'and', 'are', 'as', 'at', 'be', 'campaign', 'create',
  'do', 'for', 'from', 'i', 'in', 'is', 'it', 'lensello', 'like', 'make',
  'me', 'more', 'need', 'of', 'on', 'photo', 'photos', 'photograph',
  'photographs', 'picture', 'pictures', 'post', 'posts', 'showing', 'some',
  'that', 'the', 'this', 'to', 'up', 'us', 'want', 'we', 'with', 'would',
]);

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, dozen: 12,
};

/** Lowercase, strip possessives and punctuation, split on whitespace. */
function tokenize(prompt: string): string[] {
  return prompt
    .toLowerCase()
    .replace(/['’]s\b/g, '') // "groom's" -> "groom"
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

/** A number spelled out or written as a digit, anywhere in the brief. */
function findRequestedCount(prompt: string, tokens: readonly string[]): number | null {
  const digitMatch = prompt.match(/\b(\d{1,3})\b/);
  if (digitMatch) {
    const value = Number.parseInt(digitMatch[1]!, 10);
    if (value > 0) return value;
  }

  for (const token of tokens) {
    const value = NUMBER_WORDS[token];
    if (value) return value;
  }

  return null;
}

function findShootType(tokens: readonly string[]): ShootType | null {
  const set = new Set(tokens);
  for (const type of SHOOT_TYPES) {
    // 'real_estate' -> 'real' / 'estate' both being present is a fair signal;
    // every other type is one token already.
    const parts = type.split('_');
    if (parts.every((part) => set.has(part))) return type;
  }
  return null;
}

/**
 * The heuristic path: no model, just word extraction.
 *
 * Deliberately conservative — every label it proposes came directly from a
 * word the photographer typed, so a search built on it is explainable even
 * without an AI call in the loop.
 */
export function heuristicInterpret(
  prompt: string,
  context: { knownShootTypes?: readonly ShootType[] } = {},
): InterpretedBrief {
  const trimmed = prompt.trim();
  const tokens = tokenize(trimmed);

  const shootType = findShootType(tokens);
  const knownShootTypes = context.knownShootTypes;
  const shootTypeInLibrary =
    shootType && (!knownShootTypes || knownShootTypes.includes(shootType))
      ? shootType
      : null;

  const labels = [
    ...new Set(
      tokens.filter(
        (token) =>
          token.length >= 3 &&
          !STOPWORDS.has(token) &&
          !(SHOOT_TYPES as readonly string[]).includes(token) &&
          !token.split('_').some((part) => STOPWORDS.has(part)),
      ),
    ),
  ].slice(0, 8);

  const requestedCount = findRequestedCount(trimmed, tokens);

  return {
    summary: trimmed.length > 0 ? trimmed : 'An empty brief.',
    labels,
    shootType: shootTypeInLibrary,
    count: clampShortlistSize(requestedCount ?? DEFAULT_SHORTLIST_SIZE),
    notes: null,
    method: 'heuristic',
  };
}

/** Loose validation of whatever `generateJson` handed back. */
function sanitizeAiInterpretation(
  raw: unknown,
  knownShootTypes: readonly ShootType[],
): InterpretedBrief | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const value = raw as Record<string, unknown>;

  const summary = typeof value.summary === 'string' ? value.summary.trim() : '';
  if (summary.length === 0) return null;

  const labels = Array.isArray(value.labels)
    ? [
        ...new Set(
          value.labels
            .filter((label): label is string => typeof label === 'string')
            .map((label) => label.trim().toLowerCase())
            .filter((label) => label.length > 0 && label.length <= 40),
        ),
      ].slice(0, 8)
    : [];
  if (labels.length === 0) return null;

  const rawShootType = typeof value.shootType === 'string' ? value.shootType : null;
  const shootType =
    rawShootType && knownShootTypes.includes(rawShootType as ShootType)
      ? (rawShootType as ShootType)
      : null;

  const count = clampShortlistSize(
    typeof value.count === 'number' ? value.count : DEFAULT_SHORTLIST_SIZE,
  );

  const notes =
    typeof value.notes === 'string' && value.notes.trim().length > 0
      ? value.notes.trim().slice(0, 500)
      : null;

  return { summary, labels, shootType, count, notes, method: 'ai' };
}

/**
 * Interprets the brief, preferring the model when it is configured.
 *
 * Never throws: a model failure of any kind falls through to the heuristic so
 * the photographer always gets a shortlist, even if a weaker one.
 */
export async function interpretBrief(
  prompt: string,
  context: { knownShootTypes: readonly ShootType[] },
): Promise<InterpretedBrief> {
  if (isAiConfigured()) {
    try {
      const built = buildStudioInterpretPrompt({
        prompt,
        knownShootTypes: context.knownShootTypes,
      });
      const raw = await generateJson<unknown>(built, { maxTokens: 600 });
      const sanitized = sanitizeAiInterpretation(raw, context.knownShootTypes);
      if (sanitized) return sanitized;
    } catch (cause) {
      if (!(cause instanceof AiError)) throw cause;
      // Fall through to the heuristic below.
    }
  }

  return heuristicInterpret(prompt, { knownShootTypes: context.knownShootTypes });
}
