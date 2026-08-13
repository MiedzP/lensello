import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { getLessonBySlug, getModuleBySlug, listResourcesForLesson } from '@/lib/academy/queries';
import { DeleteLessonForm } from '../../../components/delete-lesson-form';
import { EditLessonMetaForm } from '../../../components/edit-lesson-meta-form';
import { LessonEditor } from '../../../components/lesson-editor';
import { ResourceForm } from '../../../components/resource-form';
import { ResourceList } from '../../../components/resource-list';

export const metadata: Metadata = { title: 'Edit lesson' };

export default async function EditLessonPage(
  props: PageProps<'/academy/[moduleSlug]/[lessonSlug]/edit'>,
) {
  const { moduleSlug, lessonSlug } = await props.params;
  const { supabase } = await requireUserOrRedirect();

  const mod = await getModuleBySlug(supabase, moduleSlug);
  if (!mod) notFound();

  const lesson = await getLessonBySlug(supabase, mod.id, lessonSlug);
  if (!lesson) notFound();

  const resources = await listResourcesForLesson(supabase, lesson.id);

  return (
    <>
      <Link
        href={`/academy/${mod.slug}/${lesson.slug}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        {lesson.title}
      </Link>
      <PageHeader title="Edit lesson" />

      <Card className="mb-6">
        <CardHeader title="Details" />
        <CardBody>
          <EditLessonMetaForm lesson={lesson} />
        </CardBody>
      </Card>

      <Card className="mb-6">
        <CardHeader title="Body" description="Written by the studio — nothing here is pre-filled." />
        <CardBody>
          <LessonEditor lessonId={lesson.id} initialBody={lesson.body_md} />
        </CardBody>
      </Card>

      <Card className="mb-6">
        <CardHeader title="Resources" />
        <CardBody className="space-y-4">
          <ResourceList resources={resources} />
          <details className="rounded-md border border-dashed border-strong">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-foreground">
              Add a resource
            </summary>
            <div className="border-t border-subtle p-3">
              <ResourceForm lessonId={lesson.id} />
            </div>
          </details>
        </CardBody>
      </Card>

      <DeleteLessonForm lessonId={lesson.id} moduleSlug={mod.slug} />
    </>
  );
}
