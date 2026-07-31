import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Inbox / all-clients switch.
 *
 * Navigation, not in-page tabs — the view belongs in the URL so it can be
 * bookmarked, shared, and restored by the back button. That is also why these
 * are links marked with `aria-current` rather than ARIA `tab` roles: there is no
 * tabpanel here, just two pages.
 */
export function ViewTabs({
  view,
  unhandledCount,
}: {
  view: 'inbox' | 'clients';
  unhandledCount: number;
}) {
  return (
    <nav aria-label="Client views" className="mb-5 flex gap-1 border-b border-subtle">
      <Tab href="/clients" label="Inbox" isActive={view === 'inbox'} count={unhandledCount} />
      <Tab href="/clients?view=clients" label="All clients" isActive={view === 'clients'} />
    </nav>
  );
}

function Tab({
  href,
  label,
  isActive,
  count,
}: {
  href: '/clients' | '/clients?view=clients';
  label: string;
  isActive: boolean;
  count?: number;
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        '-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'border-accent text-foreground'
          : 'border-transparent text-muted hover:text-foreground',
      )}
    >
      {label}
      {count !== undefined && count > 0 ? (
        <span className="rounded-full bg-accent-subtle px-1.5 py-0.5 text-xs tabular-nums text-accent">
          {count}
          <span className="sr-only"> waiting on a reply</span>
        </span>
      ) : null}
    </Link>
  );
}
