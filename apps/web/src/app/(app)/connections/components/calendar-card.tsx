'use client';

import { useState } from 'react';
import { Calendar, Check, ChevronDown, Copy, ExternalLink } from 'lucide-react';
import { Badge, Button, Card, CardBody } from '@/components/ui';

/**
 * Connecting the studio calendar, explained on the page rather than in a file.
 *
 * Two people read this and they can do different things. The photographer owns
 * the Google account and can do everything except the last step; whoever runs
 * the app can do the last step and nothing before it. Written so each can see
 * which parts are theirs and stop at the handover, instead of one of them
 * getting stuck halfway through somebody else's job.
 *
 * The unusual part — sharing a calendar with a robot address — gets its reason
 * up front. Without it the instruction looks like a mistake and people go
 * looking for a "Sign in with Google" button that deliberately is not there.
 */

const SETUP_COMMAND = 'npm run calendar:setup -- ~/Downloads/<the-key-file>.json';

/** Everything the Google account holder can do alone. */
const GOOGLE_STEPS: Array<{ title: string; detail: string }> = [
  {
    title: 'Create a project in Google Cloud',
    detail:
      'Open console.cloud.google.com and make a project, or pick one you already have. The name is only ever seen by you.',
  },
  {
    title: 'Turn on the Calendar API',
    detail:
      'In that project: APIs & Services → Library → search "Google Calendar API" → Enable. Nothing works until this is on, and the error it produces does not say so.',
  },
  {
    title: 'Create a service account',
    detail:
      'APIs & Services → Credentials → Create credentials → Service account. Give it any name. Skip the two optional steps about roles and user access — it does not need them.',
  },
  {
    title: 'Download its key',
    detail:
      'Open the service account you just made → Keys → Add key → Create new key → JSON. A file downloads. Treat it like a password: anyone holding it can reach whatever you share with it.',
  },
  {
    title: 'Share the calendar with it',
    detail:
      'The service account has an email address ending @…iam.gserviceaccount.com — copy it. In Google Calendar, hover the studio calendar → ⋮ → Settings and sharing → Share with specific people or groups → Add people → paste that address → set the permission to "Make changes to events". Read-only is not enough; confirming a gig has to write.',
  },
];

export function CalendarCard({
  status,
  calendarId,
  serviceAccount,
}: {
  status: 'live' | 'mock' | 'unavailable';
  /** Which calendar events go to, when one is configured. */
  calendarId: string | null;
  serviceAccount: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const connected = status === 'live';

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 gap-2.5">
            <Calendar size={18} className="mt-0.5 shrink-0 text-faint" aria-hidden="true" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">Studio calendar</h3>
              <p className="mt-0.5 truncate text-sm text-muted">
                {connected && calendarId ? calendarId : 'Not connected'}
              </p>
            </div>
          </div>

          {connected ? (
            <Badge tone="success">Connected</Badge>
          ) : (
            <Badge tone="warning">Simulated</Badge>
          )}
        </div>

        {connected ? (
          <>
            <p className="text-sm text-muted">
              Confirming a gig puts it on this calendar, editing its times moves
              the event, and cancelling removes it.
            </p>
            {serviceAccount ? (
              <p className="text-xs text-faint">
                Writing as {serviceAccount}. To revoke access, remove that
                address from the calendar&rsquo;s sharing settings — it takes
                effect immediately and touches nothing else in your Google
                account.
              </p>
            ) : null}
          </>
        ) : (
          <p className="rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-xs text-warning">
            Confirming a gig currently records the booking against the built-in
            simulator. Nothing reaches a real calendar, so keep booking times in
            your own diary until this is connected.
          </p>
        )}

        <Button type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
          <ChevronDown
            size={14}
            aria-hidden="true"
            className={open ? 'rotate-180 transition-transform' : 'transition-transform'}
          />
          {open ? 'Hide setup steps' : connected ? 'Setup steps' : 'How to connect it'}
        </Button>

        {open ? (
          <div className="space-y-4 rounded-md border border-subtle bg-surface-raised p-4">
            <div>
              <p className="text-sm font-medium text-foreground">
                Why you share a calendar instead of signing in
              </p>
              <p className="mt-1 text-xs text-muted">
                Google treats calendar access as sensitive, so an app that has
                not been through their review has its sign-in expire every seven
                days — you would be reconnecting this weekly, forever. Instead
                you create a robot account and share the calendar with it, the
                same way you would share it with an assistant. Nothing expires,
                it only ever sees calendars you explicitly share, and you take
                access away from Google Calendar&rsquo;s own sharing settings
                rather than from in here.
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground">
                In your Google account
              </p>
              <p className="mt-1 text-xs text-muted">
                About five minutes, and all of it is on Google&rsquo;s site.
              </p>
              <ol className="mt-2.5 list-decimal space-y-2 pl-5 text-xs text-muted">
                {GOOGLE_STEPS.map((step) => (
                  <li key={step.title}>
                    <span className="font-medium text-foreground">{step.title}.</span>{' '}
                    {step.detail}
                  </li>
                ))}
              </ol>

              <div className="mt-3 flex flex-wrap gap-3">
                <a
                  href="https://console.cloud.google.com/projectcreate"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  Google Cloud console
                  <ExternalLink size={11} aria-hidden="true" />
                </a>
                <a
                  href="https://calendar.google.com/calendar/r/settings"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  Calendar sharing settings
                  <ExternalLink size={11} aria-hidden="true" />
                </a>
              </div>
            </div>

            <div className="border-t border-subtle pt-4">
              <p className="text-sm font-medium text-foreground">
                Then hand the file over
              </p>
              <p className="mt-1 text-xs text-muted">
                The last step is a command, so it belongs to whoever runs
                Lensello. Send them the downloaded file — securely, it is a
                credential — and they run:
              </p>

              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 overflow-x-auto rounded border border-subtle bg-surface px-2.5 py-2 text-xs text-foreground">
                  {SETUP_COMMAND}
                </code>
                <Button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(SETUP_COMMAND)
                      .then(() => setCopied(true));
                  }}
                >
                  {copied ? (
                    <Check size={14} aria-hidden="true" />
                  ) : (
                    <Copy size={14} aria-hidden="true" />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>

              <p className="mt-2 text-xs text-muted">
                It checks each thing above by doing it — whether the API is on,
                whether the calendar was shared, whether it was shared writable
                — and says which step to go back to if not. It finishes by
                creating a test event and deleting it, so a pass means bookings
                will genuinely appear.
              </p>
            </div>

            {!connected ? (
              <p className="border-t border-subtle pt-4 text-xs text-muted">
                <span className="text-foreground">How you will know it worked:</span>{' '}
                the amber note above becomes a green “Connected”, and the warning
                on each gig&rsquo;s status panel disappears. If it is still amber
                after setup, the values reached someone&rsquo;s laptop but not
                the deployed site.
              </p>
            ) : null}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
