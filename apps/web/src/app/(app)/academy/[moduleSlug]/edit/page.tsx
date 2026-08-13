import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { getModuleBySlug } from '@/lib/academy/queries';
import { EditModuleForm } from '../../components/edit-module-form';

export const metadata: Metadata = { title: 'Edit module' };

export default async function EditModulePage(props: PageProps<'/academy/[moduleSlug]/edit'>) {
  const { moduleSlug } = await props.params;
  const { supabase } = await requireUserOrRedirect();

  const mod = await getModuleBySlug(supabase, moduleSlug);
  if (!mod) notFound();

  return (
    <>
      <Link
        href={`/academy/${mod.slug}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        {mod.title}
      </Link>
      <PageHeader title="Edit module" />
      <EditModuleForm module={mod} />
    </>
  );
}
