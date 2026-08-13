import Link from 'next/link';
import { CalendarClock, Images, StickyNote } from 'lucide-react';
import { Badge, Card, CardBody, CardHeader } from '@/components/ui';
import { CLIENT_STAGE_LABELS, GIG_STATUS_LABELS } from '@lensello/core';
import { CLIENT_SOURCE_LABELS, CLIENT_STAGE_TONES } from '@/lib/clients/stages';
import { shortDate } from '@/lib/clients/format';
import type { ConversationDetail } from '@/lib/conversations/queries';
import { IdentitiesPanel } from './identities-panel';
import { MergePanel } from './merge-panel';
import { StageControl } from './stage-control';

/**
 * "You can see customer contact details in the page where you message them."
 *
 * Everything the studio needs about this person without leaving the inbox:
 * who they are, every way they can be reached, their funnel stage and
 * consent, and what has already happened with them. Full editing of the base
 * record — name, email, notes text — stays on the Clients module's own page,
 * linked from here, rather than duplicated.
 */
export function CrmPanel({ detail }: { detail: ConversationDetail }) {
  const { client, conversation, identities, recentGigs, recentGalleries } = detail;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={client.name}
          description={`From ${CLIENT_SOURCE_LABELS[client.source]} · last contacted ${shortDate(client.last_contacted_at)}`}
          action={
            <Link
              href={`/clients/${client.id}`}
              className="text-xs font-medium text-muted transition-colors hover:text-foreground"
            >
              Full record →
            </Link>
          }
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={CLIENT_STAGE_TONES[client.stage]}>{CLIENT_STAGE_LABELS[client.stage]}</Badge>
            <Badge tone={client.marketing_consent ? 'success' : 'neutral'}>
              {client.marketing_consent ? 'Marketing consent' : 'No marketing consent'}
            </Badge>
          </div>

          <StageControl clientId={client.id} stage={client.stage} />

          {client.notes ? (
            <div className="flex items-start gap-2 text-xs text-muted">
              <StickyNote size={13} className="mt-0.5 shrink-0 text-faint" aria-hidden="true" />
              <p className="whitespace-pre-wrap">{client.notes}</p>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Contact identities" description="Every way this person can be reached." />
        <CardBody>
          <IdentitiesPanel clientId={client.id} identities={identities} />
        </CardBody>
      </Card>

      {(recentGigs.length > 0 || recentGalleries.length > 0) && (
        <Card>
          <CardHeader title="Recent activity" />
          <CardBody className="space-y-3">
            {recentGigs.map((gig) => (
              <div key={gig.id} className="flex items-start gap-2 text-xs">
                <CalendarClock size={13} className="mt-0.5 shrink-0 text-faint" aria-hidden="true" />
                <div>
                  <p className="font-medium text-foreground">{gig.title}</p>
                  <p className="text-faint">
                    {GIG_STATUS_LABELS[gig.status]} · {shortDate(gig.starts_at)}
                  </p>
                </div>
              </div>
            ))}
            {recentGalleries.map((gallery) => (
              <div key={gallery.id} className="flex items-start gap-2 text-xs">
                <Images size={13} className="mt-0.5 shrink-0 text-faint" aria-hidden="true" />
                <div>
                  <Link
                    href={`/library/${gallery.shoot_id}`}
                    className="font-medium text-foreground hover:text-accent"
                  >
                    {gallery.title}
                  </Link>
                  <p className="text-faint">Shared {shortDate(gallery.created_at)}</p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Wrong client?" />
        <CardBody>
          <MergePanel conversationId={conversation.id} currentClientId={client.id} />
        </CardBody>
      </Card>
    </div>
  );
}
