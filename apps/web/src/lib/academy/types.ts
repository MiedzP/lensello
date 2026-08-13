/**
 * Shared shapes for the academy module.
 *
 * These are intentionally generic — a worksheet field is `{key, label, type,
 * help, options?}` regardless of which business fills it in, and nothing here
 * names this studio.
 */

import type { Tables } from '@/lib/db.types';

export type WorksheetFieldType = 'text' | 'textarea' | 'list' | 'select';

export interface WorksheetField {
  key: string;
  label: string;
  type: WorksheetFieldType;
  help?: string;
  /** Only meaningful when `type` is `'select'`. */
  options?: string[];
}

/** A `'list'` field's answer is an array of strings; everything else is a string. */
export type AnswerValue = string | string[];

export type WorksheetAnswers = Record<string, AnswerValue>;

/** The seven columns a worksheet can roll up into. Kept in one place because
 * the mapping from `profile_key` to a `business_profile` column must be
 * exact — see `lib/academy/profile.ts`. */
export type ProfileKey = NonNullable<Tables<'academy_worksheets'>['profile_key']>;

export const PROFILE_KEYS: readonly ProfileKey[] = [
  'swot',
  'seven_ps',
  'positioning',
  'target_client',
  'customer_journey',
  'brand_voice',
  'price_point',
];

/** Parses a worksheet's `schema` jsonb column into typed fields. Anything
 * malformed is dropped rather than thrown on — a hand-edited row should
 * degrade, not 500 the page. */
export function parseWorksheetSchema(schema: unknown): WorksheetField[] {
  if (!Array.isArray(schema)) return [];
  const fields: WorksheetField[] = [];
  for (const raw of schema) {
    if (typeof raw !== 'object' || raw === null) continue;
    const candidate = raw as Record<string, unknown>;
    if (typeof candidate.key !== 'string' || typeof candidate.label !== 'string') continue;
    const type: WorksheetFieldType =
      candidate.type === 'textarea' || candidate.type === 'list' || candidate.type === 'select'
        ? candidate.type
        : 'text';
    const field: WorksheetField = { key: candidate.key, label: candidate.label, type };
    if (typeof candidate.help === 'string') field.help = candidate.help;
    if (Array.isArray(candidate.options)) {
      field.options = candidate.options.filter((o): o is string => typeof o === 'string');
    }
    fields.push(field);
  }
  return fields;
}
