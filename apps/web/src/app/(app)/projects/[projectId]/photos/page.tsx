import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHeader, EmptyState } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { PhotosClient } from './photos-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Project Photos' };

interface PhotosPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function PhotosPage(props: PhotosPageProps) {
  const params = await props.params;
  const { projectId } = params;
  const { supabase, user } = await requireUserOrRedirect();

  // Fetch project to verify it exists
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, name, client_id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();

  if (projectError || !project) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title={`${project.name} — Photos`}
        description="Upload, edit, and organize project photos"
      />

      <PhotosClient projectId={projectId} />
    </>
  );
}
