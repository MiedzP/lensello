import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { Card, CardBody, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { ModuleIcon } from '@/lib/academy/icons';
import { getModuleBySlug, listLessonsForModule, listResourcesForModule } from '@/lib/academy/queries';
import { CreateLessonForm } from '../components/create-lesson-form';
import { LessonRow } from '../components/lesson-row';
import { PublishForm } from '../components/publish-form';
import { ResourceForm } from '../components/resource-form';
import { ResourceList } from '../components/resource-list';
import { setModulePublished } from '../actions';

export async function generateMetadata(
  props: PageProps<'/academy/[moduleSlug]'>,
): Promise<Metadata> {
  const { moduleSlug } = await props.params;
  return { title: moduleSlug };
}

export default async function AcademyModulePage(props: PageProps<'/academy/[moduleSlug]'>) {
  const { moduleSlug } = await props.params;
  const { user, supabase } = await requireUserOrRedirect();

  const mod = await getModuleBySlug(supabase, moduleSlug);
  if (!mod) notFound();

  const [lessons, resources] = await Promise.all([
    listLessonsForModule(supabase, mod.id, user.id),
    listResourcesForModule(supabase, mod.id),
  ]);

  return (
    <>
      <Link href="/academy" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={14} aria-hidden="true" />
        Academy
      </Link>

      <PageHeader
        title={mod.title}
        description={mod.summary}
        action={
          <div className="flex items-center gap-2">
            <PublishForm
              action={setModulePublished}
              hiddenName="moduleId"
              hiddenValue={mod.id}
              isPublished={mod.is_published}
            />
            <Link
              href={`/academy/${mod.slug}/edit`}
              className="rounded-md border border-strong bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-hover"
            >
              Edit module
            </Link>
          </div>
        }
      />

      <div className="mb-3 flex items-center gap-2 text-sm text-muted">
        <ModuleIcon iconName={mod.icon} size={16} aria-hidden="true" />
        {lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'}
      </div>

      {lessons.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={22} aria-hidden="true" />}
          title="No lessons yet"
          description="Add the first lesson below."
        />
      ) : (
        <ul className="space-y-2">
          {lessons.map((lesson, index) => (
            <LessonRow
              key={lesson.id}
              moduleSlug={mod.slug}
              moduleId={mod.id}
              lesson={lesson}
              isFirst={index === 0}
              isLast={index === lessons.length - 1}
            />
          ))}
        </ul>
      )}

      <details className="mt-4 rounded-md border border-dashed border-strong">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
          Add a lesson
        </summary>
        <div className="border-t border-subtle px-4 py-4">
          <CreateLessonForm moduleId={mod.id} />
        </div>
      </details>

      <Card className="mt-6">
        <CardHeader title="Resources" description="Templates, checklists, and outbound links for this module." />
        <CardBody className="space-y-4">
          <ResourceList resources={resources} />
          <details className="rounded-md border border-dashed border-strong">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-foreground">
              Add a resource
            </summary>
            <div className="border-t border-subtle p-3">
              <ResourceForm moduleId={mod.id} />
            </div>
          </details>
        </CardBody>
      </Card>
    </>
  );
}
