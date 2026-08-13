'use server';

/**
 * Direct edits to `business_profile`.
 *
 * The row is staff-wide (it describes the business, not a person), so any
 * signed-in staff member may edit it — unlike worksheet answers. There is
 * exactly one row, enforced by the table's primary key being the literal
 * `true`; every action here updates `.eq('id', true)` and never inserts, so
 * there is no path that could create a second one.
 */

import { updateTag } from 'next/cache';
import { requireUser } from '@/lib/auth';
import type { ActionState } from '@/lib/academy/action-state';
import type { TablesUpdate } from '@/lib/db.types';

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function toLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function invalidateProfile(): void {
  updateTag('business-profile');
  updateTag('academy');
}

const TEXT_FIELDS = [
  'business_name',
  'positioning',
  'target_client',
  'price_point',
  'unique_value',
  'brand_voice',
  'service_area',
] as const;
type TextField = (typeof TEXT_FIELDS)[number];

/** One text column at a time, so a stray extra input in the form can never
 * overwrite a field the person editing did not intend to touch. */
export async function updateBusinessProfileText(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, supabase } = await requireUser();

  const key = field(formData, 'field');
  if (!TEXT_FIELDS.includes(key as TextField)) {
    return { ok: false, message: 'That is not a business profile field.' };
  }

  const value = field(formData, 'value');
  const patch = {
    [key]: value || null,
    updated_by: user.id,
  } as Partial<TablesUpdate<'business_profile'>>;

  const { error } = await supabase.from('business_profile').update(patch).eq('id', true);

  if (error) return { ok: false, message: `Could not save: ${error.message}` };

  invalidateProfile();
  return { ok: true, message: 'Saved.' };
}

export async function updateBusinessProfileSwot(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, supabase } = await requireUser();

  const swot = {
    strengths: toLines(field(formData, 'strengths')),
    weaknesses: toLines(field(formData, 'weaknesses')),
    opportunities: toLines(field(formData, 'opportunities')),
    threats: toLines(field(formData, 'threats')),
  };

  const { error } = await supabase
    .from('business_profile')
    .update({ swot, updated_by: user.id })
    .eq('id', true);

  if (error) return { ok: false, message: `Could not save: ${error.message}` };

  invalidateProfile();
  return { ok: true, message: 'Saved.' };
}

const SEVEN_PS_KEYS = [
  'product',
  'price',
  'place',
  'promotion',
  'people',
  'process',
  'physical_evidence',
] as const;

export async function updateBusinessProfileSevenPs(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, supabase } = await requireUser();

  const sevenPs: Record<string, string> = {};
  for (const key of SEVEN_PS_KEYS) sevenPs[key] = field(formData, key);

  const { error } = await supabase
    .from('business_profile')
    .update({ seven_ps: sevenPs, updated_by: user.id })
    .eq('id', true);

  if (error) return { ok: false, message: `Could not save: ${error.message}` };

  invalidateProfile();
  return { ok: true, message: 'Saved.' };
}

/**
 * The journey is an ordered list of `{stage, touchpoints}`, edited as
 * repeated `stage`/`touchpoints` form fields (same index in each array lines
 * up one row). Rebuilt from those two arrays rather than trusting a posted
 * JSON blob — a stray field cannot inject an unexpected shape.
 */
export async function updateBusinessProfileJourney(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, supabase } = await requireUser();

  const stages = formData.getAll('stage').map((value) => String(value).trim());
  const touchpoints = formData.getAll('touchpoints').map((value) => String(value).trim());

  const journey = stages
    .map((stage, index) => ({ stage, touchpoints: touchpoints[index] ?? '' }))
    // A row with neither a stage name nor any touchpoints is a blank template
    // row the person never filled in — drop it rather than store nothing.
    .filter((row) => row.stage.length > 0 || row.touchpoints.length > 0)
    .slice(0, 20);

  const { error } = await supabase
    .from('business_profile')
    .update({ customer_journey: journey, updated_by: user.id })
    .eq('id', true);

  if (error) return { ok: false, message: `Could not save: ${error.message}` };

  invalidateProfile();
  return { ok: true, message: 'Saved.' };
}
