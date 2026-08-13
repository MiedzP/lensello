'use server';

/**
 * Worksheet answers: draft autosave, and the submit that rolls up to
 * `business_profile`.
 *
 * `academy_worksheet_responses` is policied to `user_id = auth.uid()` — a
 * colleague's half-finished SWOT is personal, not team-wide — so every query
 * here is scoped to the caller's own id, taken from `requireUser()`, never
 * from the form. A draft save never touches `business_profile`; only
 * `submitWorksheetResponse` does, and it does so through the pure
 * `buildProfilePatch` so the mapping from worksheet to profile column is
 * tested independently of Supabase.
 */

import { updateTag } from 'next/cache';
import { requireUser, type Session } from '@/lib/auth';
import type { ActionState } from '@/lib/academy/action-state';
import type { Json } from '@/lib/db.types';
import { buildProfilePatch } from '@/lib/academy/profile';
import { getWorksheetBySlug } from '@/lib/academy/queries';
import type { AnswerValue, WorksheetAnswers, WorksheetField } from '@/lib/academy/types';

type Db = Session['supabase'];

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Reads answers out of the posted form according to the worksheet's own
 * field list — the schema is the only source of truth for which keys are
 * legitimate, so a POST cannot smuggle in an arbitrary key that later ends
 * up in `business_profile`.
 */
function readAnswers(formData: FormData, fields: WorksheetField[]): WorksheetAnswers {
  const answers: WorksheetAnswers = {};
  for (const fieldDef of fields) {
    const raw = formData.get(fieldDef.key);
    if (typeof raw !== 'string') continue;
    const value: AnswerValue =
      fieldDef.type === 'list'
        ? raw
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
        : raw.trim();
    answers[fieldDef.key] = value;
  }
  return answers;
}

async function loadWorksheet(supabase: Db, lessonId: string, worksheetSlug: string) {
  const worksheet = await getWorksheetBySlug(supabase, lessonId, worksheetSlug);
  if (!worksheet) throw new Error('That worksheet no longer exists.');
  return worksheet;
}

/** Saves whatever is in the form right now, without touching `submitted_at`
 * or the business profile. Called on every autosave tick. */
export async function saveWorksheetDraft(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, supabase } = await requireUser();

  const lessonId = field(formData, 'lessonId');
  const worksheetSlug = field(formData, 'worksheetSlug');
  if (!lessonId || !worksheetSlug) return { ok: false, message: 'Missing worksheet.' };

  const worksheet = await loadWorksheet(supabase, lessonId, worksheetSlug);
  const answers = readAnswers(formData, worksheet.fields);

  const { error } = await supabase.from('academy_worksheet_responses').upsert(
    {
      worksheet_id: worksheet.id,
      user_id: user.id,
      answers: answers as unknown as Json,
    },
    { onConflict: 'worksheet_id,user_id' },
  );

  if (error) return { ok: false, message: `Could not save your draft: ${error.message}` };

  return { ok: true, message: 'Draft saved.' };
}

/**
 * Marks the response submitted and, if the worksheet has a `profile_key`,
 * writes the roll-up into the single `business_profile` row.
 *
 * Always updates the existing row (`.eq('id', true)`) — never an insert.
 * `business_profile`'s primary key is the literal `true`, so a second row is
 * not just wrong but rejected by the database; this still never attempts one.
 */
export async function submitWorksheetResponse(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, supabase } = await requireUser();

  const lessonId = field(formData, 'lessonId');
  const worksheetSlug = field(formData, 'worksheetSlug');
  if (!lessonId || !worksheetSlug) return { ok: false, message: 'Missing worksheet.' };

  const worksheet = await loadWorksheet(supabase, lessonId, worksheetSlug);
  const answers = readAnswers(formData, worksheet.fields);
  const submittedAt = new Date().toISOString();

  const { error: responseError } = await supabase.from('academy_worksheet_responses').upsert(
    {
      worksheet_id: worksheet.id,
      user_id: user.id,
      answers: answers as unknown as Json,
      submitted_at: submittedAt,
    },
    { onConflict: 'worksheet_id,user_id' },
  );

  if (responseError) {
    return { ok: false, message: `Could not submit: ${responseError.message}` };
  }

  const patch = buildProfilePatch(worksheet.profile_key, worksheet.fields, answers);
  if (patch) {
    const { error: profileError } = await supabase
      .from('business_profile')
      .update({ ...patch, updated_by: user.id })
      .eq('id', true);

    if (profileError) {
      return {
        ok: false,
        message: `Your answers were saved, but updating the business profile failed: ${profileError.message}`,
      };
    }
  }

  updateTag('academy');
  updateTag('business-profile');

  return {
    ok: true,
    message: patch
      ? 'Submitted — the business profile has been updated.'
      : 'Submitted.',
  };
}
