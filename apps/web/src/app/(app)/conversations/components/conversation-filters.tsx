import Link from 'next/link';
import type { Route } from 'next';
import { cn } from '@/lib/utils';
import {
  CHANNEL_LABELS,
  MESSAGE_CHANNELS,
  STATUS_LABELS,
  CONVERSATION_STATUSES,
  type ConversationStatus,
  type MessageChannel,
} from '@/lib/conversations/channels';
import type { InboxFacets } from '@/lib/conversations/queries';
import type { ProfileRow } from '@/lib/conversations/queries';

/**
 * Filter chips as links, not client-side state — the filtered view is a real,
 * bookmarkable URL and no JavaScript is required to change it, the same
 * choice `StageFilter` makes in the Clients module.
 *
 * `statusParam` distinguishes "no status chosen" (defaults to open, the
 * working set) from the explicit "All" chip, which has to clear the filter
 * rather than fall back to it.
 */
export function ConversationFilters({
  channel,
  status,
  statusParam,
  assignedTo,
  facets,
  staff,
}: {
  channel: MessageChannel | null;
  status: ConversationStatus | null;
  statusParam: string | null;
  assignedTo: string | null;
  facets: InboxFacets;
  staff: ProfileRow[];
}) {
  const present = MESSAGE_CHANNELS.filter((c) => (facets.channelCounts[c] ?? 0) > 0);

  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium tracking-wide text-faint uppercase">
          Status
        </span>
        <Chip
          href={buildHref({ channel, statusParam: 'all', assignedTo })}
          label="All"
          isActive={statusParam === 'all'}
        />
        {CONVERSATION_STATUSES.map((s) => (
          <Chip
            key={s}
            href={buildHref({ channel, statusParam: s, assignedTo })}
            label={STATUS_LABELS[s]}
            isActive={statusParam !== 'all' && (status ?? 'open') === s}
            count={facets.statusCounts[s]}
          />
        ))}
      </div>

      {present.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium tracking-wide text-faint uppercase">
            Channel
          </span>
          <Chip
            href={buildHref({ channel: null, statusParam, assignedTo })}
            label="All"
            isActive={channel === null}
          />
          {present.map((c) => (
            <Chip
              key={c}
              href={buildHref({ channel: c, statusParam, assignedTo })}
              label={CHANNEL_LABELS[c]}
              isActive={channel === c}
              count={facets.channelCounts[c]}
            />
          ))}
        </div>
      ) : null}

      {staff.length > 0 ? (
        <form
          method="get"
          action="/conversations"
          className="flex flex-wrap items-center gap-2"
        >
          <span className="text-xs font-medium tracking-wide text-faint uppercase">
            Assignee
          </span>
          {channel ? <input type="hidden" name="channel" value={channel} /> : null}
          {statusParam ? <input type="hidden" name="status" value={statusParam} /> : null}
          <select
            name="assignee"
            defaultValue={assignedTo ?? ''}
            className="h-8 rounded-md border border-strong bg-surface px-2 text-xs text-foreground"
          >
            <option value="">Anyone</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name || 'Unnamed'}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md border border-strong px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            Filter
          </button>
        </form>
      ) : null}
    </div>
  );
}

function buildHref(input: {
  channel: MessageChannel | null;
  statusParam: string | null;
  assignedTo: string | null;
}): Route {
  const params = new URLSearchParams();
  if (input.channel) params.set('channel', input.channel);
  if (input.statusParam) params.set('status', input.statusParam);
  if (input.assignedTo) params.set('assignee', input.assignedTo);

  const query = params.toString();
  // typedRoutes wants a literal for a static path; a computed query string is
  // the documented escape hatch, same as `StageFilter`.
  return (query ? `/conversations?${query}` : '/conversations') as Route;
}

function Chip({
  href,
  label,
  isActive,
  count,
}: {
  href: Route;
  label: string;
  isActive: boolean;
  count?: number;
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? 'true' : undefined}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
        isActive
          ? 'border-accent bg-accent-subtle text-accent'
          : 'border-subtle text-muted hover:bg-surface-hover hover:text-foreground',
      )}
    >
      {label}
      {count !== undefined && count > 0 ? (
        <span className="tabular-nums opacity-70">{count}</span>
      ) : null}
    </Link>
  );
}
