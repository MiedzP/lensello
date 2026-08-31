'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import type { Tone } from '@/components/ui/badge';

interface ProjectData {
  id: string;
  name: string;
  client: string;
  status: 'active' | 'on_hold' | 'completed' | 'cancelled';
  deadline?: string | null;
  progress?: number;
  href?: string;
}

const statusConfig: Record<ProjectData['status'], { label: string; tone: Tone }> = {
  active: { label: 'Active', tone: 'success' },
  on_hold: { label: 'On Hold', tone: 'warning' },
  completed: { label: 'Completed', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'error' },
};

/**
 * Project card component for displaying project info in dashboard.
 * Shows name, client, status, deadline, and progress bar.
 * Clickable to navigate to project detail.
 */
export function ProjectCard({
  project,
  children,
}: {
  project: ProjectData;
  children?: ReactNode;
}) {
  const router = useRouter();
  const config = statusConfig[project.status];

  const handleClick = () => {
    if (project.href) {
      router.push(project.href);
    }
  };

  const deadline = project.deadline
    ? new Date(project.deadline).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : null;

  const isOverdue = project.deadline
    ? new Date(project.deadline) < new Date()
    : false;

  return (
    <div
      onClick={handleClick}
      className="rounded-lg border border-subtle bg-surface p-4 transition-colors hover:bg-surface-hover cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-foreground truncate">
            {project.name}
          </h3>
          <p className="text-xs text-muted mt-0.5">
            {project.client}
          </p>
        </div>
        <Badge tone={config.tone} className="shrink-0">
          {config.label}
        </Badge>
      </div>

      {project.progress !== undefined && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted">Progress</span>
            <span className="text-xs font-medium text-muted">
              {project.progress}%
            </span>
          </div>
          <div className="h-2 bg-subtle rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${project.progress}%` }}
            />
          </div>
        </div>
      )}

      {deadline && (
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted">Due</span>
          <span
            className={`text-xs font-medium ${
              isOverdue ? 'text-error' : 'text-foreground'
            }`}
          >
            {deadline}
            {isOverdue && ' ⚠'}
          </span>
        </div>
      )}

      {children}
    </div>
  );
}
