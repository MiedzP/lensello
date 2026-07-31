import type { Metadata } from 'next';
import { ErrorNote, PageHeader } from '@/components/ui';
import { CLIENT_STAGES, type ClientStage } from '@lensello/core';
import { requireUserOrRedirect } from '@/lib/auth';
import {
  countUnhandled,
  listClients,
  listUnhandledInbound,
} from '@/lib/clients/queries';
import { ClientTable } from './components/client-table';
import { InboxList } from './components/inbox-list';
import { StageFilter } from './components/stage-filter';
import { SyncInboxButton } from './components/sync-inbox-button';
import { ViewTabs } from './components/view-tabs';

export const metadata: Metadata = { title: 'Clients' };

/** searchParams values arrive as `string | string[] | undefined`. */
function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseStage(value: string | string[] | undefined): ClientStage | null {
  const raw = first(value);
  return CLIENT_STAGES.find((stage) => stage === raw) ?? null;
}

export default async function ClientsPage(props: PageProps<'/clients'>) {
  const { supabase } = await requireUserOrRedirect();
  // Async in Next 16 — searchParams is a Promise.
  const searchParams = await props.searchParams;

  // The inbox is the default. Someone opening this section is far more often
  // asking "what needs a reply" than browsing a directory.
  const view = first(searchParams.view) === 'clients' ? 'clients' : 'inbox';
  const stage = parseStage(searchParams.stage);

  const [unhandledCount, inbox, clients] = await Promise.all([
    countUnhandled(supabase),
    view === 'inbox' ? listUnhandledInbound(supabase) : null,
    view === 'clients' ? listClients(supabase, stage) : null,
  ]);

  const readError = inbox?.error ?? clients?.error ?? null;

  return (
    <>
      <PageHeader
        title="Clients"
        description={
          view === 'inbox'
            ? 'Inquiries waiting on a reply, newest first.'
            : 'Everyone in the pipeline, most recently contacted first.'
        }
        action={<SyncInboxButton />}
      />

      <ViewTabs view={view} unhandledCount={unhandledCount} />

      {readError ? (
        <ErrorNote>Could not load this view: {readError}</ErrorNote>
      ) : view === 'inbox' ? (
        <InboxList items={inbox?.items ?? []} />
      ) : (
        <>
          <StageFilter active={stage} />
          <ClientTable items={clients?.items ?? []} stage={stage} />
        </>
      )}
    </>
  );
}
