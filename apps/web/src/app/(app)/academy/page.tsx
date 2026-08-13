import type { Metadata } from 'next';
import Link from 'next/link';
import { ClipboardList, GraduationCap } from 'lucide-react';
import { Card, CardBody, EmptyState, PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { listModulesWithStats } from '@/lib/academy/queries';
import { CreateModuleForm } from './components/create-module-form';
import { ModuleCard } from './components/module-card';

export const metadata: Metadata = { title: 'Academy' };

/**
 * The academy home: every module (published or still a draft — this is the
 * internal editing view, not a client-facing course catalogue), with each
 * person's own progress, and a way straight to the business profile that the
 * worksheets in these modules feed.
 */
export default async function AcademyPage() {
  const { user, supabase } = await requireUserOrRedirect();

  const modules = await listModulesWithStats(supabase, user.id);
  const totalLessons = modules.reduce((sum, mod) => sum + mod.lessonCount, 0);
  const completedLessons = modules.reduce((sum, mod) => sum + mod.completedCount, 0);

  return (
    <>
      <PageHeader
        title="Academy"
        description="Marketing training, worksheets, and what Lensello knows about the business."
        action={
          <Link
            href="/academy/profile"
            className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover"
          >
            <ClipboardList size={16} aria-hidden="true" />
            Business profile
          </Link>
        }
      />

      {totalLessons > 0 ? (
        <Card className="mb-6">
          <CardBody className="flex flex-wrap items-center gap-6">
            <div>
              <p className="text-xs font-medium tracking-wide text-muted uppercase">Your progress</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                {completedLessons}
                <span className="text-base font-normal text-muted"> / {totalLessons} lessons</span>
              </p>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {modules.length === 0 ? (
        <EmptyState
          icon={<GraduationCap size={22} aria-hidden="true" />}
          title="No modules yet"
          description="Create the first one below."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => (
            <ModuleCard key={mod.id} module={mod} />
          ))}
        </div>
      )}

      <details className="mt-8 rounded-md border border-dashed border-strong">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
          Add a module
        </summary>
        <div className="border-t border-subtle px-4 py-4">
          <CreateModuleForm />
        </div>
      </details>
    </>
  );
}
