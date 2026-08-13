import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock, FileEdit } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { renderLessonMarkdown } from '@/lib/academy/markdown';
import {
  getLessonBySlug,
  getLessonProgress,
  getModuleBySlug,
  getOwnWorksheetResponse,
  listResourcesForLesson,
  listWorksheetsForLesson,
} from '@/lib/academy/queries';
import type { WorksheetAnswers } from '@/lib/academy/types';
import { LessonContent } from '../../components/prose';
import { ProgressControl } from '../../components/progress-control';
import { PublishBadge } from '../../components/badges';
import { PublishForm } from '../../components/publish-form';
import { ResourceList } from '../../components/resource-list';
import { WorksheetForm } from '../../components/worksheet-form';
import { setLessonPublished } from '../../actions';

export async function generateMetadata(
  props: PageProps<'/academy/[moduleSlug]/[lessonSlug]'>,
): Promise<Metadata> {
  const { lessonSlug } = await props.params;
  return { title: lessonSlug };
}

export default async function AcademyLessonPage(
  props: PageProps<'/academy/[moduleSlug]/[lessonSlug]'>,
) {
  const { moduleSlug, lessonSlug } = await props.params;
  const { user, supabase } = await requireUserOrRedirect();

  const mod = await getModuleBySlug(supabase, moduleSlug);
  if (!mod) notFound();

  const lesson = await getLessonBySlug(supabase, mod.id, lessonSlug);
  if (!lesson) notFound();

  const [progress, resources, worksheets] = await Promise.all([
    getLessonProgress(supabase, lesson.id, user.id),
    listResourcesForLesson(supabase, lesson.id),
    listWorksheetsForLesson(supabase, lesson.id),
  ]);

  const worksheetResponses = await Promise.all(
    worksheets.map((worksheet) => getOwnWorksheetResponse(supabase, worksheet.id, user.id)),
  );

  return (
    <>
      <Link
        href={`/academy/${mod.slug}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        {mod.title}
      </Link>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <PublishBadge isPublished={lesson.is_published} />
        {lesson.estimated_minutes ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <Clock size={12} aria-hidden="true" />
            {lesson.estimated_minutes} min
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 pb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{lesson.title}</h1>
          {lesson.summary ? <p className="mt-1 max-w-prose text-sm text-muted">{lesson.summary}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <PublishForm
            action={setLessonPublished}
            hiddenName="lessonId"
            hiddenValue={lesson.id}
            isPublished={lesson.is_published}
          />
          <Link
            href={`/academy/${mod.slug}/${lesson.slug}/edit`}
            className="inline-flex items-center gap-1.5 rounded-md border border-strong bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-hover"
          >
            <FileEdit size={14} aria-hidden="true" />
            Edit
          </Link>
        </div>
      </div>

      {lesson.body_md.trim() === '' ? (
        <Card>
          <CardBody className="py-10 text-center">
            <p className="text-sm text-muted">
              This lesson has not been written yet.{' '}
              <Link href={`/academy/${mod.slug}/${lesson.slug}/edit`} className="text-accent hover:underline">
                Write it now
              </Link>
              .
            </p>
          </CardBody>
        </Card>
      ) : (
        <LessonContent html={renderLessonMarkdown(lesson.body_md)} />
      )}

      <div className="mt-8">
        <ProgressControl lessonId={lesson.id} status={progress?.status ?? null} />
      </div>

      {worksheets.length > 0 ? (
        <div className="mt-8 space-y-6">
          {worksheets.map((worksheet, index) => {
            const response = worksheetResponses[index] ?? null;
            const answers = (response?.answers ?? {}) as WorksheetAnswers;
            return (
              <div key={worksheet.id}>
                {worksheet.intro ? (
                  <p className="mb-3 text-sm text-muted">{worksheet.intro}</p>
                ) : null}
                <WorksheetForm
                  lessonId={lesson.id}
                  worksheetSlug={worksheet.slug}
                  fields={worksheet.fields}
                  initialAnswers={answers}
                  submittedAt={response?.submitted_at ?? null}
                />
              </div>
            );
          })}
        </div>
      ) : null}

      {resources.length > 0 ? (
        <Card className="mt-8">
          <CardHeader title="Resources" />
          <CardBody>
            <ResourceList resources={resources} />
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
