/**
 * Resolves a run's `trigger_payload` into the rows steps actually need.
 *
 * The payload is `jsonb` and its shape is a contract, not a type: every
 * dispatch call site agrees to send `{ clientId?, gigId?, galleryId?, extra? }`
 * (documented in `dispatch.ts`). This resolves the ids it recognises into real
 * rows, once per run, so every step reads from the same snapshot rather than
 * each re-querying — two steps in one run must see the same client stage even
 * if a concurrent edit lands mid-run.
 *
 * Best-effort by design: an id that no longer resolves (a client deleted
 * between the event firing and the run executing) leaves that part of the
 * context `null` rather than failing the whole run before any step has had a
 * chance to run. Individual steps that require a client say so themselves.
 */

import type { createAdminClient } from '@/lib/supabase/admin';
import type { Automation, RunContext, TriggerKind } from './types';

type Admin = ReturnType<typeof createAdminClient>;

function stringField(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export async function buildRunContext(
  admin: Admin,
  automation: Pick<Automation, 'id' | 'name'>,
  triggerKind: TriggerKind,
  payload: Record<string, unknown>,
): Promise<RunContext> {
  const clientId = stringField(payload, 'clientId');
  const gigId = stringField(payload, 'gigId');
  const galleryId = stringField(payload, 'galleryId');

  const [clientResult, gigResult, galleryResult] = await Promise.all([
    clientId
      ? admin.from('clients').select('*').eq('id', clientId).maybeSingle()
      : Promise.resolve({ data: null }),
    gigId ? admin.from('gigs').select('*').eq('id', gigId).maybeSingle() : Promise.resolve({ data: null }),
    galleryId
      ? admin.from('galleries').select('*').eq('id', galleryId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    automation: { id: automation.id, name: automation.name },
    trigger: { kind: triggerKind, payload },
    client: clientResult.data ?? null,
    gig: gigResult.data ?? null,
    gallery: galleryResult.data ?? null,
  };
}

/** Flattens a `RunContext` for `renderTemplate` / `evaluateBranchCondition`. */
export function templateVars(context: RunContext): Record<string, unknown> {
  return {
    automation: context.automation,
    trigger: context.trigger.payload,
    client: context.client ?? {},
    gig: context.gig ?? {},
    gallery: context.gallery ?? {},
  };
}
