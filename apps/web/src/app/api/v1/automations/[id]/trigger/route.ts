/**
 * `POST /api/v1/automations/[id]/trigger` — fires a `webhook`- or
 * `manual`-trigger automation on purpose.
 *
 * This is the literal shape of the client's ask: "build automations into the
 * platform (API key)". Only those two trigger kinds are accepted here —
 * event-driven and polled kinds have their own paths (`dispatchAutomationEvent`,
 * the cron reconciler) and letting an API key fire a `client_stage_changed`
 * automation without an actual stage change would make the run history lie
 * about what happened.
 *
 * The JSON body becomes the run's `trigger_payload`, exactly like any other
 * caller of `runAutomation` — the rate limit, loop guard, and per-step
 * `continue_on_error` behaviour are identical to a click of "Run now".
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateApiRequest } from '@/lib/automations/api-auth';
import { runAutomation } from '@/lib/automations/runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request, context: RouteContext<'/api/v1/automations/[id]/trigger'>) {
  const auth = await authenticateApiRequest(request, 'automations:trigger');
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'That is not a valid automation id.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: automation } = await admin.from('automations').select('*').eq('id', id).maybeSingle();

  if (!automation) {
    return NextResponse.json({ error: 'No automation with that id.' }, { status: 404 });
  }

  if (automation.trigger_kind !== 'webhook' && automation.trigger_kind !== 'manual') {
    return NextResponse.json(
      {
        error:
          `This automation's trigger is "${automation.trigger_kind}", which does not accept an API trigger. ` +
          'Only automations set to trigger on "webhook" or "manual" can be started this way.',
      },
      { status: 409 },
    );
  }

  let payload: Record<string, unknown> = {};
  const contentLength = request.headers.get('content-length');
  if (contentLength && contentLength !== '0') {
    try {
      const body = await request.json();
      if (body && typeof body === 'object' && !Array.isArray(body)) {
        payload = body as Record<string, unknown>;
      }
    } catch {
      return NextResponse.json({ error: 'The request body is not valid JSON.' }, { status: 400 });
    }
  }

  const outcome = await runAutomation(admin, automation, { triggerPayload: payload, chain: [] });

  return NextResponse.json({ runId: outcome.runId, status: outcome.status });
}
