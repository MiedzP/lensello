import Link from 'next/link';
import { GIG_STATUS_LABELS, SHOOT_TYPE_LABELS, formatCents } from '@lensello/core';
import { Badge, Card, CardHeader } from '@/components/ui';
import { whenLabel } from '@/lib/gigs/display';
import {
  DEPOSIT_STATE_LABELS,
  DEPOSIT_STATE_TONES,
  GIG_STATUS_TONES,
  depositState,
  type ClientRef,
  type GigRow,
} from '@/lib/gigs/types';

/**
 * List alternative to the calendar: upcoming soonest-first, then history.
 *
 * A real `<table>` with a `<caption>` and row headers, because this is tabular
 * data and a screen reader user should be able to ask "what column is this?".
 */
export function GigList({
  upcoming,
  past,
  clients,
}: {
  upcoming: GigRow[];
  past: GigRow[];
  clients: Map<string, ClientRef>;
}) {
  return (
    <div className="space-y-6">
      <GigTable
        title="Upcoming"
        description={`${upcoming.length} ${upcoming.length === 1 ? 'gig' : 'gigs'} still to shoot`}
        gigs={upcoming}
        clients={clients}
        emptyMessage="Nothing on the books yet."
      />

      {past.length > 0 ? (
        <GigTable
          title="Past"
          description="Most recent first"
          gigs={past}
          clients={clients}
          emptyMessage="No past gigs."
        />
      ) : null}
    </div>
  );
}

function GigTable({
  title,
  description,
  gigs,
  clients,
  emptyMessage,
}: {
  title: string;
  description: string;
  gigs: GigRow[];
  clients: Map<string, ClientRef>;
  emptyMessage: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title={title} description={description} />

      {gigs.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted">{emptyMessage}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <caption className="sr-only">{`${title} gigs`}</caption>
            <thead>
              <tr className="border-b border-subtle text-left">
                <Th>Gig</Th>
                <Th>When</Th>
                <Th>Client</Th>
                <Th>Location</Th>
                <Th className="text-right">Price</Th>
                <Th>Deposit</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {gigs.map((gig) => {
                const client = gig.client_id ? clients.get(gig.client_id) : undefined;
                const deposit = depositState(gig);

                return (
                  <tr
                    key={gig.id}
                    className="border-b border-subtle last:border-b-0 hover:bg-surface-hover"
                  >
                    <th scope="row" className="px-4 py-3 text-left font-normal align-top">
                      <Link
                        href={`/gigs/${gig.id}`}
                        className="font-medium text-foreground underline-offset-2 hover:underline"
                      >
                        {gig.title}
                      </Link>
                      <span className="mt-0.5 block text-xs text-muted">
                        {SHOOT_TYPE_LABELS[gig.type]}
                      </span>
                    </th>
                    <Td className="whitespace-nowrap text-muted">
                      {whenLabel(gig.starts_at, gig.ends_at)}
                    </Td>
                    <Td className="text-muted">{client?.name ?? '—'}</Td>
                    <Td className="text-muted">{gig.location ?? '—'}</Td>
                    <Td className="text-right tabular-nums text-foreground">
                      {formatCents(gig.price_cents)}
                    </Td>
                    <Td>
                      <Badge tone={DEPOSIT_STATE_TONES[deposit]}>
                        {deposit === 'due' || deposit === 'requested'
                          ? `${DEPOSIT_STATE_LABELS[deposit]} · ${formatCents(gig.deposit_cents)}`
                          : DEPOSIT_STATE_LABELS[deposit]}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge tone={GIG_STATUS_TONES[gig.status]}>
                        {GIG_STATUS_LABELS[gig.status]}
                      </Badge>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`px-4 py-2.5 text-xs font-medium tracking-wide text-muted uppercase ${className ?? ''}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className ?? ''}`}>{children}</td>;
}
