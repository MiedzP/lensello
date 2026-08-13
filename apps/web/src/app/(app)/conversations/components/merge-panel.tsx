'use client';

import { useActionState, useState, useTransition } from 'react';
import { GitMerge } from 'lucide-react';
import { ErrorNote, Input } from '@/components/ui';
import { mergeConversationAction, searchClientsAction } from '../actions';
import { INITIAL_SIMPLE } from '../form-state';

interface FoundClient {
  id: string;
  name: string;
  email: string | null;
}

/**
 * Moves this thread — and everything filed under it — onto a different
 * client record.
 *
 * For the case the client described: a DM or a form submission arrived from
 * a handle nobody recognised, `syncSocialMessages` or `fileInboundMessages`
 * created a fresh client for it, and staff now knows exactly who that was.
 */
export function MergePanel({
  conversationId,
  currentClientId,
}: {
  conversationId: string;
  currentClientId: string;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoundClient[]>([]);
  const [searching, startSearch] = useTransition();
  const [mergeState, mergeAction] = useActionState(mergeConversationAction, INITIAL_SIMPLE);

  function handleSearch(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    startSearch(async () => {
      const found = await searchClientsAction(value);
      setResults(found.filter((client) => client.id !== currentClientId));
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">
        Wrong client? Find the right one and move this whole thread onto them.
      </p>
      <Input
        value={query}
        onChange={(event) => handleSearch(event.target.value)}
        placeholder="Search by name or email…"
        className="h-8 text-xs"
      />
      {mergeState.error ? <ErrorNote>{mergeState.error}</ErrorNote> : null}
      {mergeState.message ? <p className="text-xs text-success">{mergeState.message}</p> : null}

      {searching ? <p className="text-xs text-faint">Searching…</p> : null}

      {results.length > 0 ? (
        <ul className="space-y-1.5">
          {results.map((client) => (
            <li
              key={client.id}
              className="flex items-center justify-between gap-2 rounded-md border border-subtle px-2.5 py-1.5 text-xs"
            >
              <div className="min-w-0 truncate">
                <span className="font-medium text-foreground">{client.name}</span>
                {client.email ? <span className="ml-1.5 text-faint">{client.email}</span> : null}
              </div>
              <form action={mergeAction}>
                <input type="hidden" name="conversationId" value={conversationId} />
                <input type="hidden" name="targetClientId" value={client.id} />
                <button
                  type="submit"
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-strong px-2 py-0.5 text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                >
                  <GitMerge size={11} aria-hidden="true" />
                  Merge
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

