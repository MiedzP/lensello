'use client';

import { useEffect, useTransition } from 'react';
import { markThreadReadAction } from '../actions';

/**
 * Zeroes the thread's unread badge once it has actually mounted in the
 * browser.
 *
 * Deliberately not done in the Server Component that loads the page: Next may
 * render a route speculatively (Link prefetching) before the studio has
 * looked at anything, and a `useEffect` only runs once this has really
 * committed to the screen, so a prefetch can never silently mark a thread
 * read.
 */
export function MarkThreadRead({ conversationId }: { conversationId: string }) {
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(() => {
      void markThreadReadAction(conversationId);
    });
    // Re-run whenever the studio opens a different thread.
  }, [conversationId, startTransition]);

  return null;
}
