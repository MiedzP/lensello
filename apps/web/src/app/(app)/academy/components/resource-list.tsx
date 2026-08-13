import { CirclePlay, Download, ExternalLink, FileText, Link as LinkIcon, Users } from 'lucide-react';
import { Badge } from '@/components/ui';
import type { ResourceRow } from '@/lib/academy/queries';
import { deleteResource } from '../actions';

const KIND_ICON: Record<ResourceRow['kind'], typeof LinkIcon> = {
  template: FileText,
  checklist: FileText,
  link: LinkIcon,
  download: Download,
  video: CirclePlay,
  community: Users,
};

const KIND_LABEL: Record<ResourceRow['kind'], string> = {
  template: 'Template',
  checklist: 'Checklist',
  link: 'Link',
  download: 'Download',
  video: 'Video',
  community: 'Community',
};

export function ResourceList({ resources }: { resources: ResourceRow[] }) {
  if (resources.length === 0) {
    return <p className="text-sm text-muted">No resources yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {resources.map((resource) => {
        const Icon = KIND_ICON[resource.kind];
        return (
          <li
            key={resource.id}
            className="flex items-start gap-3 rounded-md border border-subtle bg-surface px-3 py-2.5"
          >
            <Icon size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-foreground">{resource.title}</p>
                <Badge tone="neutral">{KIND_LABEL[resource.kind]}</Badge>
              </div>
              {resource.description ? (
                <p className="mt-0.5 text-xs text-muted">{resource.description}</p>
              ) : null}
              {resource.url ? (
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  Open <ExternalLink size={11} aria-hidden="true" />
                </a>
              ) : (
                <p className="mt-1 text-xs text-faint">No link set yet.</p>
              )}
            </div>
            <form action={deleteResource}>
              <input type="hidden" name="resourceId" value={resource.id} />
              <button type="submit" className="shrink-0 text-xs text-muted hover:text-danger">
                Remove
              </button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
