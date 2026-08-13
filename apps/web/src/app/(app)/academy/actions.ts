'use server';

/**
 * Mutations for the course structure: modules, lessons, resources, progress.
 *
 * Every action opens with `requireUser()` — reachable by direct POST, so the
 * fact that the UI only shows an "Edit" button to a signed-in staff member
 * proves nothing about what a bare POST will try. `academy_modules`,
 * `academy_lessons`, and `academy_resources` are staff-wide (any staff member
 * may edit the course, same as they could edit a shared campaign), but
 * `academy_progress` is written scoped to `auth.uid()` in the query itself —
 * never to an id read out of the form — because RLS aside, a mutation that
 * *could* touch another user's row from a lesson page is a bug in its own
 * right.
 *
 * Worksheet answers and business-profile edits live in their own action
 * files (`worksheet-actions.ts`, `profile-actions.ts`) — different tables,
 * different RLS shape, kept separate on purpose.
 */

import { updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser, type Session } from '@/lib/auth';
import { slugify, type ActionState } from '@/lib/academy/action-state';

type Db = Session['supabase'];

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function optionalField(formData: FormData, key: string): string | null {
  const value = field(formData, key);
  return value === '' ? null : value;
}

function invalidateAcademy(): void {
  updateTag('academy');
}

// --- modules ---------------------------------------------------------------

export async function createModule(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const title = field(formData, 'title');
  if (!title) return { ok: false, message: 'A title is required.' };

  const { data: existing } = await supabase
    .from('academy_modules')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (existing?.sort_order ?? -1) + 1;

  const slug = slugify(title);
  const { error } = await supabase.from('academy_modules').insert({
    slug,
    title,
    summary: optionalField(formData, 'summary'),
    icon: optionalField(formData, 'icon'),
    sort_order: nextOrder,
  });

  if (error) {
    return {
      ok: false,
      message: error.code === '23505'
        ? 'A module with that title already exists.'
        : `Could not create the module: ${error.message}`,
    };
  }

  invalidateAcademy();
  return { ok: true, message: `"${title}" created as a draft.` };
}

export async function updateModule(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const moduleId = field(formData, 'moduleId');
  const title = field(formData, 'title');
  if (!moduleId || !title) return { ok: false, message: 'A title is required.' };

  const { error } = await supabase
    .from('academy_modules')
    .update({
      title,
      summary: optionalField(formData, 'summary'),
      icon: optionalField(formData, 'icon'),
      accent_color: optionalField(formData, 'accentColor'),
    })
    .eq('id', moduleId);

  if (error) return { ok: false, message: `Could not save: ${error.message}` };

  invalidateAcademy();
  return { ok: true, message: 'Saved.' };
}

export async function setModulePublished(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const moduleId = field(formData, 'moduleId');
  const published = field(formData, 'published') === '1';
  if (!moduleId) return;

  const { error } = await supabase
    .from('academy_modules')
    .update({ is_published: published })
    .eq('id', moduleId);
  if (error) throw new Error(`Could not update the module: ${error.message}`);

  invalidateAcademy();
}

export async function deleteModule(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const moduleId = field(formData, 'moduleId');
  if (!moduleId) return;

  // Lessons and resources cascade via their foreign keys.
  const { error } = await supabase.from('academy_modules').delete().eq('id', moduleId);
  if (error) throw new Error(`Could not delete the module: ${error.message}`);

  redirect('/academy');
}

// --- lessons -----------------------------------------------------------------

export async function createLesson(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const moduleId = field(formData, 'moduleId');
  const title = field(formData, 'title');
  if (!moduleId || !title) return { ok: false, message: 'A title is required.' };

  const existingLessons = await listLessonsForModuleForOrdering(supabase, moduleId);
  const nextOrder = existingLessons.length;

  const { error } = await supabase.from('academy_lessons').insert({
    module_id: moduleId,
    slug: slugify(title),
    title,
    summary: optionalField(formData, 'summary'),
    sort_order: nextOrder,
  });

  if (error) {
    return {
      ok: false,
      message: error.code === '23505'
        ? 'A lesson with that title already exists in this module.'
        : `Could not create the lesson: ${error.message}`,
    };
  }

  invalidateAcademy();
  return { ok: true, message: `"${title}" created as a draft.` };
}

async function listLessonsForModuleForOrdering(
  supabase: Db,
  moduleId: string,
): Promise<{ id: string }[]> {
  const { data } = await supabase.from('academy_lessons').select('id').eq('module_id', moduleId);
  return data ?? [];
}

export async function updateLessonMeta(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const lessonId = field(formData, 'lessonId');
  const title = field(formData, 'title');
  if (!lessonId || !title) return { ok: false, message: 'A title is required.' };

  const minutesRaw = field(formData, 'estimatedMinutes');
  const estimatedMinutes = minutesRaw ? Number.parseInt(minutesRaw, 10) : null;

  const { error } = await supabase
    .from('academy_lessons')
    .update({
      title,
      summary: optionalField(formData, 'summary'),
      estimated_minutes:
        estimatedMinutes !== null && Number.isFinite(estimatedMinutes) && estimatedMinutes > 0
          ? estimatedMinutes
          : null,
    })
    .eq('id', lessonId);

  if (error) return { ok: false, message: `Could not save: ${error.message}` };

  invalidateAcademy();
  return { ok: true, message: 'Saved.' };
}

/**
 * The editor's save action. Separate from `updateLessonMeta` because the
 * editor autosaves the body on a timer — a title/summary edit should not be
 * folded into that same frequent write.
 */
export async function updateLessonBody(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const lessonId = field(formData, 'lessonId');
  if (!lessonId) return { ok: false, message: 'Missing lesson.' };

  const bodyMd = formData.get('bodyMd');
  const { error } = await supabase
    .from('academy_lessons')
    .update({ body_md: typeof bodyMd === 'string' ? bodyMd : '' })
    .eq('id', lessonId);

  if (error) return { ok: false, message: `Could not save: ${error.message}` };

  invalidateAcademy();
  return { ok: true, message: 'Saved.' };
}

export async function setLessonPublished(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const lessonId = field(formData, 'lessonId');
  const published = field(formData, 'published') === '1';
  if (!lessonId) return;

  const { error } = await supabase
    .from('academy_lessons')
    .update({ is_published: published })
    .eq('id', lessonId);
  if (error) throw new Error(`Could not update the lesson: ${error.message}`);

  invalidateAcademy();
}

export async function deleteLesson(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const lessonId = field(formData, 'lessonId');
  const moduleSlug = field(formData, 'moduleSlug');
  if (!lessonId) return;

  const { error } = await supabase.from('academy_lessons').delete().eq('id', lessonId);
  if (error) throw new Error(`Could not delete the lesson: ${error.message}`);

  invalidateAcademy();
  redirect(moduleSlug ? `/academy/${moduleSlug}` : '/academy');
}

/** Swaps `sort_order` with the adjacent lesson, same pattern as the gigs
 * checklist reorder. */
export async function moveLesson(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const moduleId = field(formData, 'moduleId');
  const lessonId = field(formData, 'lessonId');
  const direction = field(formData, 'direction');
  if (!moduleId || !lessonId || (direction !== 'up' && direction !== 'down')) return;

  const { data: lessons } = await supabase
    .from('academy_lessons')
    .select('id, sort_order')
    .eq('module_id', moduleId)
    .order('sort_order', { ascending: true });
  if (!lessons) return;

  const index = lessons.findIndex((lesson) => lesson.id === lessonId);
  if (index === -1) return;
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= lessons.length) return;

  const reordered = [...lessons];
  const moved = reordered[targetIndex]!;
  reordered[targetIndex] = reordered[index]!;
  reordered[index] = moved;

  for (const [position, lesson] of reordered.entries()) {
    if (lesson.sort_order === position) continue;
    const { error } = await supabase
      .from('academy_lessons')
      .update({ sort_order: position })
      .eq('id', lesson.id);
    if (error) throw new Error(`Could not reorder lessons: ${error.message}`);
  }

  invalidateAcademy();
}

// --- resources ---------------------------------------------------------------

export async function createResource(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const title = field(formData, 'title');
  const kind = field(formData, 'kind');
  const moduleId = optionalField(formData, 'moduleId');
  const lessonId = optionalField(formData, 'lessonId');

  if (!title) return { ok: false, message: 'A title is required.' };
  if ((moduleId ? 1 : 0) + (lessonId ? 1 : 0) !== 1) {
    return { ok: false, message: 'A resource belongs to exactly one module or lesson.' };
  }
  const validKinds = [
    'template',
    'checklist',
    'link',
    'download',
    'video',
    'community',
  ] as const;
  type ResourceKind = (typeof validKinds)[number];
  if (!validKinds.includes(kind as ResourceKind)) {
    return { ok: false, message: 'Not a valid resource kind.' };
  }

  const { error } = await supabase.from('academy_resources').insert({
    title,
    description: optionalField(formData, 'description'),
    kind: kind as ResourceKind,
    url: optionalField(formData, 'url'),
    module_id: moduleId,
    lesson_id: lessonId,
  });

  if (error) return { ok: false, message: `Could not add the resource: ${error.message}` };

  invalidateAcademy();
  return { ok: true, message: 'Resource added.' };
}

export async function updateResource(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const resourceId = field(formData, 'resourceId');
  const title = field(formData, 'title');
  if (!resourceId || !title) return { ok: false, message: 'A title is required.' };

  const { error } = await supabase
    .from('academy_resources')
    .update({
      title,
      description: optionalField(formData, 'description'),
      url: optionalField(formData, 'url'),
    })
    .eq('id', resourceId);

  if (error) return { ok: false, message: `Could not save: ${error.message}` };

  invalidateAcademy();
  return { ok: true, message: 'Saved.' };
}

export async function deleteResource(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const resourceId = field(formData, 'resourceId');
  if (!resourceId) return;

  const { error } = await supabase.from('academy_resources').delete().eq('id', resourceId);
  if (error) throw new Error(`Could not delete the resource: ${error.message}`);

  invalidateAcademy();
}

// --- progress ----------------------------------------------------------------

/**
 * Upserts the caller's own progress row. `user_id` comes from the resolved
 * session, never from the form — `academy_progress` is policied to
 * `user_id = auth.uid()`, and this is the one place that policy actually gets
 * exercised, so the query has to agree with it rather than merely survive it.
 */
export async function setLessonProgress(formData: FormData): Promise<void> {
  const { user, supabase } = await requireUser();

  const lessonId = field(formData, 'lessonId');
  const status = field(formData, 'status');
  if (!lessonId || (status !== 'in_progress' && status !== 'complete')) return;

  const { error } = await supabase.from('academy_progress').upsert(
    {
      lesson_id: lessonId,
      user_id: user.id,
      status,
      completed_at: status === 'complete' ? new Date().toISOString() : null,
    },
    { onConflict: 'lesson_id,user_id' },
  );

  if (error) throw new Error(`Could not update progress: ${error.message}`);

  invalidateAcademy();
}
