import Link from 'next/link';
import type { Route } from 'next';
import { CLIENT_STAGES, CLIENT_STAGE_LABELS, type ClientStage } from '@lensello/core';
import { cn } from '@/lib/utils';

/**
 * Stage filter as links, so the filtered view is a real URL and no JavaScript is
 * required to change it.
 */
export function StageFilter({ active }: { active: ClientStage | null }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-medium tracking-wide text-faint uppercase">
        Stage
      </span>
      <Chip href="/clients?view=clients" label="All" isActive={active === null} />
      {CLIENT_STAGES.map((stage) => (
        <Chip
          key={stage}
          // Built from a `const` array, so the literal cannot drift from the
          // routes that exist; typedRoutes still wants the cast for a computed
          // query string.
          href={`/clients?view=clients&stage=${stage}` as Route}
          label={CLIENT_STAGE_LABELS[stage]}
          isActive={active === stage}
        />
      ))}
    </div>
  );
}

function Chip({
  href,
  label,
  isActive,
}: {
  href: Route;
  label: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? 'true' : undefined}
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
        isActive
          ? 'border-accent bg-accent-subtle text-accent'
          : 'border-subtle text-muted hover:bg-surface-hover hover:text-foreground',
      )}
    >
      {label}
    </Link>
  );
}
