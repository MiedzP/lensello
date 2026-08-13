/**
 * Read helpers for the academy module.
 *
 * Every query goes through the caller's Supabase client, so RLS applies.
 * `academy_progress` and `academy_worksheet_responses` are additionally
 * scoped to `user_id` in the query itself (`.eq('user_id', userId)`) — RLS
 * would refuse a cross-user read anyway, but the query should say what it
 * means rather than relying only on the policy to catch a mistake.
 *
 * Joins are done in JS rather than with Supabase's embedded-resource syntax:
 * `db.types.ts` declares `Relationships: []` for every table here, so an
 * embedded select does not type-check — same convention as `lib/gigs`.
 */

import type { Session } from '@/lib/auth';
import type { Tables } from '@/lib/db.types';
import { parseWorksheetSchema, type ProfileKey, type WorksheetField } from './types';

type Db = Session['supabase'];

export type ModuleRow = Tables<'academy_modules'>;
export type LessonRow = Tables<'academy_lessons'>;
export type ResourceRow = Tables<'academy_resources'>;
export type ProgressRow = Tables<'academy_progress'>;
export type WorksheetRow = Tables<'academy_worksheets'>;
export type WorksheetResponseRow = Tables<'academy_worksheet_responses'>;
export type BusinessProfileRow = Tables<'business_profile'>;

function fail(context: string, error: { message: string } | null): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

// --- modules ---------------------------------------------------------------

export interface ModuleWithStats extends ModuleRow {
  lessonCount: number;
  publishedLessonCount: number;
  completedCount: number;
}

/** Every module, staff-visible whether published or not, with counts for the
 * index page. Draft modules are included — this is an internal editing tool,
 * not the reading view, so hiding drafts here would hide the "finish writing
 * this" reminder from the person who needs it most. */
export async function listModulesWithStats(
  supabase: Db,
  userId: string,
): Promise<ModuleWithStats[]> {
  const [{ data: modules, error: modulesError }, { data: lessons, error: lessonsError }, { data: progress, error: progressError }] =
    await Promise.all([
      supabase.from('academy_modules').select('*').order('sort_order', { ascending: true }),
      supabase.from('academy_lessons').select('id, module_id, is_published'),
      supabase
        .from('academy_progress')
        .select('lesson_id')
        .eq('user_id', userId)
        .eq('status', 'complete'),
    ]);

  fail('Could not load academy modules', modulesError);
  fail('Could not load academy lessons', lessonsError);
  fail('Could not load academy progress', progressError);

  const completedLessonIds = new Set((progress ?? []).map((row) => row.lesson_id));

  return (modules ?? []).map((mod) => {
    const moduleLessons = (lessons ?? []).filter((lesson) => lesson.module_id === mod.id);
    return {
      ...mod,
      lessonCount: moduleLessons.length,
      publishedLessonCount: moduleLessons.filter((lesson) => lesson.is_published).length,
      completedCount: moduleLessons.filter((lesson) => completedLessonIds.has(lesson.id)).length,
    };
  });
}

export async function getModuleBySlug(supabase: Db, slug: string): Promise<ModuleRow | null> {
  const { data, error } = await supabase
    .from('academy_modules')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  fail('Could not load that module', error);
  return data;
}

// --- lessons -----------------------------------------------------------------

export interface LessonWithProgress extends LessonRow {
  progress: ProgressRow | null;
}

export async function listLessonsForModule(
  supabase: Db,
  moduleId: string,
  userId: string,
): Promise<LessonWithProgress[]> {
  const [{ data: lessons, error: lessonsError }, { data: progress, error: progressError }] =
    await Promise.all([
      supabase
        .from('academy_lessons')
        .select('*')
        .eq('module_id', moduleId)
        .order('sort_order', { ascending: true }),
      supabase.from('academy_progress').select('*').eq('user_id', userId),
    ]);

  fail('Could not load lessons', lessonsError);
  fail('Could not load lesson progress', progressError);

  const progressByLesson = new Map((progress ?? []).map((row) => [row.lesson_id, row]));
  return (lessons ?? []).map((lesson) => ({
    ...lesson,
    progress: progressByLesson.get(lesson.id) ?? null,
  }));
}

export async function getLessonBySlug(
  supabase: Db,
  moduleId: string,
  lessonSlug: string,
): Promise<LessonRow | null> {
  const { data, error } = await supabase
    .from('academy_lessons')
    .select('*')
    .eq('module_id', moduleId)
    .eq('slug', lessonSlug)
    .maybeSingle();
  fail('Could not load that lesson', error);
  return data;
}

export async function getLessonProgress(
  supabase: Db,
  lessonId: string,
  userId: string,
): Promise<ProgressRow | null> {
  const { data, error } = await supabase
    .from('academy_progress')
    .select('*')
    .eq('lesson_id', lessonId)
    .eq('user_id', userId)
    .maybeSingle();
  fail('Could not load progress for that lesson', error);
  return data;
}

// --- resources ---------------------------------------------------------------

export async function listResourcesForModule(
  supabase: Db,
  moduleId: string,
): Promise<ResourceRow[]> {
  const { data, error } = await supabase
    .from('academy_resources')
    .select('*')
    .eq('module_id', moduleId)
    .order('sort_order', { ascending: true });
  fail('Could not load resources', error);
  return data ?? [];
}

export async function listResourcesForLesson(
  supabase: Db,
  lessonId: string,
): Promise<ResourceRow[]> {
  const { data, error } = await supabase
    .from('academy_resources')
    .select('*')
    .eq('lesson_id', lessonId)
    .order('sort_order', { ascending: true });
  fail('Could not load resources', error);
  return data ?? [];
}

// --- worksheets ----------------------------------------------------------

export interface WorksheetWithFields extends WorksheetRow {
  fields: WorksheetField[];
}

export async function listWorksheetsForLesson(
  supabase: Db,
  lessonId: string,
): Promise<WorksheetWithFields[]> {
  const { data, error } = await supabase
    .from('academy_worksheets')
    .select('*')
    .eq('lesson_id', lessonId)
    .order('sort_order', { ascending: true });
  fail('Could not load worksheets', error);
  return (data ?? []).map((worksheet) => ({
    ...worksheet,
    fields: parseWorksheetSchema(worksheet.schema),
  }));
}

export async function getWorksheetBySlug(
  supabase: Db,
  lessonId: string,
  worksheetSlug: string,
): Promise<WorksheetWithFields | null> {
  const { data, error } = await supabase
    .from('academy_worksheets')
    .select('*')
    .eq('lesson_id', lessonId)
    .eq('slug', worksheetSlug)
    .maybeSingle();
  fail('Could not load that worksheet', error);
  if (!data) return null;
  return { ...data, fields: parseWorksheetSchema(data.schema) };
}

/** Scoped to `userId` in the query, not only by RLS — a colleague's answers
 * must never even be requested, let alone returned. */
export async function getOwnWorksheetResponse(
  supabase: Db,
  worksheetId: string,
  userId: string,
): Promise<WorksheetResponseRow | null> {
  const { data, error } = await supabase
    .from('academy_worksheet_responses')
    .select('*')
    .eq('worksheet_id', worksheetId)
    .eq('user_id', userId)
    .maybeSingle();
  fail('Could not load your worksheet answers', error);
  return data;
}

/** All worksheets that roll up into `business_profile`, keyed by which
 * column they feed — used by the profile page to say "fill this in via the
 * <Worksheet> worksheet" next to a blank field. Includes the module/lesson
 * slugs needed to link there. */
export interface WorksheetProfileLink {
  worksheetTitle: string;
  worksheetSlug: string;
  lessonSlug: string;
  moduleSlug: string;
}

export async function listProfileKeyWorksheets(
  supabase: Db,
): Promise<Map<ProfileKey, WorksheetProfileLink>> {
  const { data: worksheets, error: worksheetsError } = await supabase
    .from('academy_worksheets')
    .select('title, slug, lesson_id, profile_key')
    .not('profile_key', 'is', null);
  fail('Could not load worksheets', worksheetsError);

  const lessonIds = [...new Set((worksheets ?? []).map((w) => w.lesson_id))];
  if (lessonIds.length === 0) return new Map();

  const { data: lessons, error: lessonsError } = await supabase
    .from('academy_lessons')
    .select('id, slug, module_id')
    .in('id', lessonIds);
  fail('Could not load lessons', lessonsError);

  const moduleIds = [...new Set((lessons ?? []).map((l) => l.module_id))];
  const { data: modules, error: modulesError } = await supabase
    .from('academy_modules')
    .select('id, slug')
    .in('id', moduleIds);
  fail('Could not load modules', modulesError);

  const lessonById = new Map((lessons ?? []).map((l) => [l.id, l]));
  const moduleById = new Map((modules ?? []).map((m) => [m.id, m]));

  const map = new Map<ProfileKey, WorksheetProfileLink>();
  for (const worksheet of worksheets ?? []) {
    if (!worksheet.profile_key) continue;
    const lesson = lessonById.get(worksheet.lesson_id);
    const mod = lesson ? moduleById.get(lesson.module_id) : undefined;
    if (!lesson || !mod) continue;
    map.set(worksheet.profile_key as ProfileKey, {
      worksheetTitle: worksheet.title,
      worksheetSlug: worksheet.slug,
      lessonSlug: lesson.slug,
      moduleSlug: mod.slug,
    });
  }
  return map;
}

// --- business profile ------------------------------------------------------

/** There is exactly one row; `.maybeSingle()` still makes the "what if it's
 * missing" case explicit rather than assuming the migration's seed row is
 * eternal. */
export async function getBusinessProfile(supabase: Db): Promise<BusinessProfileRow | null> {
  const { data, error } = await supabase
    .from('business_profile')
    .select('*')
    .eq('id', true)
    .maybeSingle();
  fail('Could not load the business profile', error);
  return data;
}

export async function getProfileName(supabase: Db, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle();
  fail('Could not load that profile', error);
  return data?.full_name ?? null;
}
