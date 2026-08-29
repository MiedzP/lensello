/**
 * Worksheet answers -> `business_profile` roll-up.
 *
 * Pure functions, deliberately kept free of Supabase: the interesting logic
 * ("what does a submitted SWOT worksheet turn into?") should be testable
 * without a database, and the actions file is a thin wrapper that authorises
 * the caller and writes the result to the single `business_profile` row.
 *
 * Only a SUBMITTED response calls into this — a draft never touches the
 * profile. That rule lives in the caller (`actions.ts`), not here.
 */

import type { TablesUpdate } from '@/lib/db.types';
import type { AnswerValue, ProfileKey, WorksheetAnswers, WorksheetField } from './types';

/** For the scalar (plain-text) profile columns, this is the one field in the
 * worksheet whose answer becomes the column value. Every other field in that
 * worksheet is scaffolding — it helps the photographer think, but only the
 * summary/statement field is what the rest of the platform reads back. */
const SCALAR_ROLLUP_FIELD: Record<
  'positioning' | 'target_client' | 'brand_voice' | 'price_point',
  string
> = {
  positioning: 'statement',
  target_client: 'summary',
  brand_voice: 'summary',
  price_point: 'summary',
};

const SEVEN_PS_KEYS = [
  'product',
  'price',
  'place',
  'promotion',
  'people',
  'process',
  'physical_evidence',
] as const;

const SWOT_KEYS = ['strengths', 'weaknesses', 'opportunities', 'threats'] as const;

function toText(value: AnswerValue | undefined): string {
  if (value === undefined) return '';
  if (Array.isArray(value)) return value.join('\n');
  return value;
}

function toList(value: AnswerValue | undefined): string[] {
  if (value === undefined) return [];
  const items = Array.isArray(value) ? value : value.split('\n');
  return items.map((item) => item.trim()).filter((item) => item.length > 0);
}

export interface CustomerJourneyStage {
  stage: string;
  touchpoints: string;
}

/**
 * Builds the `business_profile` patch a submitted worksheet response
 * produces, or `null` when the worksheet has no `profile_key` (a pure
 * exercise, nothing to roll up).
 *
 * `fields` is the worksheet's parsed schema — needed for `customer_journey`,
 * where the ordered list of stages comes from the schema's field order and
 * labels, not from a hardcoded list, so a studio that adds a sixth journey
 * stage gets it reflected here without a code change.
 */
export function buildProfilePatch(
  profileKey: ProfileKey | null,
  fields: WorksheetField[],
  answers: WorksheetAnswers,
): Partial<TablesUpdate<'business_profile'>> | null {
  if (profileKey === null) return null;

  switch (profileKey) {
    case 'swot': {
      const swot: Record<string, string[]> = {};
      for (const key of SWOT_KEYS) swot[key] = toList(answers[key]);
      return { swot };
    }

    case 'seven_ps': {
      const sevenPs: Record<string, string> = {};
      for (const key of SEVEN_PS_KEYS) sevenPs[key] = toText(answers[key]);
      return { seven_ps: sevenPs };
    }

    case 'customer_journey': {
      const stages: CustomerJourneyStage[] = fields.map((field) => ({
        stage: field.label,
        touchpoints: toText(answers[field.key]),
      }));
      return { customer_journey: stages as unknown as TablesUpdate<'business_profile'>['customer_journey'] };
    }

    case 'positioning':
    case 'target_client':
    case 'brand_voice':
    // Each of these keys is spelled exactly like the column it writes, which
    // is what lets this branch stay a single line rather than a lookup table.
    case 'price_point': {
      const value = toText(answers[SCALAR_ROLLUP_FIELD[profileKey]]).trim() || null;
      return { [profileKey]: value } as Partial<TablesUpdate<'business_profile'>>;
    }

    default: {
      // Exhaustiveness guard: TypeScript will flag this if `ProfileKey` grows
      // a value with no case above.
      const _never: never = profileKey as never;
      return _never;
    }
  }
}
