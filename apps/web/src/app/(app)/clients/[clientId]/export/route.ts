/**
 * Subject access export.
 *
 * A route handler rather than a Server Action because the useful outcome is a
 * file the operator can hand to the person who asked, and an action cannot
 * return a download.
 *
 * The export itself is an audited event. A subject access request is a legal
 * process with deadlines, and "when did we send it" is exactly the kind of
 * thing that gets asked six months later.
 */

import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { exportSubject } from '@/lib/privacy/subject';
import { recordAudit } from '@/lib/privacy/audit';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: RouteContext<'/clients/[clientId]/export'>,
) {
  let session;
  try {
    session = await requireUser();
  } catch {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { clientId } = await context.params;
  const data = await exportSubject(session.supabase, clientId);

  if (!data) {
    return NextResponse.json({ error: 'That client does not exist.' }, { status: 404 });
  }

  await recordAudit(
    session.supabase,
    { id: session.user.id, email: session.user.email },
    {
      action: 'client.exported',
      subjectType: 'client',
      subjectId: clientId,
      detail: {
        messages: data.messages.length,
        gigs: data.gigs.length,
        shoots: data.shoots.length,
      },
    },
  );

  // Slugged from the name so a folder of these is navigable, and dated so two
  // exports of the same person do not overwrite each other.
  const slug =
    data.client.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'client';
  const stamp = data.exportedAt.slice(0, 10);

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="lensello-${slug}-${stamp}.json"`,
      // Never cached: it is personal data, and a stale copy served from an
      // intermediary is a disclosure.
      'Cache-Control': 'no-store, private',
    },
  });
}
