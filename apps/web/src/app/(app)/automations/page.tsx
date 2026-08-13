import type { Metadata } from 'next';
import Link from 'next/link';
import { Bot, KeyRound, Plus } from 'lucide-react';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { listAutomations } from '@/lib/automations/queries';
import { TRIGGER_MECHANISM } from '@/lib/automations/types';
import { describeTrigger } from '@/lib/automations/display';

export const metadata: Metadata = { title: 'Automations' };

const NEW_BUTTON = (
  <Link
    href="/automations/new"
    className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
  >
    <Plus size={16} aria-hidden="true" />
    New automation
  </Link>
);

/**
 * `/automations` — every automation, its trigger, and whether it is on.
 *
 * New automations are created switched off (see the migration comment) and
 * this list is exactly where that matters: "off" is shown as loudly as "on",
 * because the whole point of the default is that a photographer notices it
 * before anything runs, not after.
 */
export default async function AutomationsPage() {
  const { supabase } = await requireUserOrRedirect();
  const automations = await listAutomations(supabase);

  return (
    <>
      <PageHeader
        title="Automations"
        description="Trigger-and-step workflows, plus the API keys that drive them."
        action={NEW_BUTTON}
      />

      <div className="mb-5">
        <Link
          href="/automations/keys"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <KeyRound size={14} aria-hidden="true" />
          API keys
        </Link>
      </div>

      {automations.length === 0 ? (
        <EmptyState
          icon={<Bot size={22} aria-hidden="true" />}
          title="No automations yet"
          description="Build one from a trigger — a client message, a booked gig, an approaching shoot — and a sequence of steps. New automations start switched off."
          action={NEW_BUTTON}
        />
      ) : (
        <Card className="divide-y divide-subtle">
          {automations.map((automation) => (
            <Link
              key={automation.id}
              href={`/automations/${automation.id}`}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-surface-hover"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{automation.name}</p>
                  <Badge tone={automation.enabled ? 'success' : 'neutral'}>
                    {automation.enabled ? 'On' : 'Off'}
                  </Badge>
                  {TRIGGER_MECHANISM[automation.trigger_kind] === 'polled' ? (
                    <Badge tone="neutral">Daily check</Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted">{describeTrigger(automation)}</p>
              </div>
              <div className="shrink-0 text-right text-xs text-faint">
                {automation.run_count} run{automation.run_count === 1 ? '' : 's'}
                {automation.last_run_at ? (
                  <div>Last: {new Date(automation.last_run_at).toLocaleString()}</div>
                ) : (
                  <div>Never run</div>
                )}
              </div>
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}
