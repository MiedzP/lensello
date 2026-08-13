/**
 * Once-a-day reconciliation for `gig_upcoming`, `campaign_task_due`, and
 * `schedule` automations — the trigger kinds with no single write event to
 * hook (see `reconcile.ts`).
 *
 * Same authentication shape as `api/cron/publish-scheduled`: a shared secret
 * in `CRON_SECRET`, sent as `Authorization: Bearer <secret>` by Vercel Cron,
 * checked in constant time, and refused entirely when the secret is unset —
 * not "runs unauthenticated", refused. There is no session here, so this uses
 * the service-role client, which is also why failing open would matter: an
 * unauthenticated caller could otherwise fire every scheduled automation in
 * the workspace on demand.
 *
 * The Vercel Hobby plan caps cron at once a day, which is exactly the cadence
 * these three trigger kinds are documented as having — see `TRIGGER_DESCRIPTIONS`
 * in `lib/automations/types.ts`. This endpoint is that once-a-day tick, not a
 * scheduler in its own right.
 */

import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { reconcileScheduledAutomations } from '@/lib/automations/reconcile';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const header = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;

  const a = Buffer.from(header, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not set, so scheduled automations are disabled.' },
      { status: 503 },
    );
  }

  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const admin = createAdminClient();
  const summary = await reconcileScheduledAutomations(admin);

  console.log(
    `[cron] automations reconciled: ${summary.gigUpcoming} gig_upcoming, ` +
      `${summary.campaignTaskDue} campaign_task_due, ${summary.schedule} schedule` +
      (summary.errors.length ? `, ${summary.errors.length} error(s)` : ''),
  );

  return NextResponse.json({ checkedAt: new Date().toISOString(), ...summary });
}
