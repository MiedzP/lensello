'use server';

/**
 * Every mutation for the gigs module.
 *
 * Each action opens with `requireUser()`. Actions are reachable by direct POST,
 * so the fact that the UI only renders a "Cancel gig" button on a confirmed gig
 * says nothing about what a caller will try to POST: status transitions, task
 * ownership, and the deposit/price invariants are all re-checked here.
 *
 * External systems are reached only through `@lensello/core/integrations`.
 * Adapter failures never roll back a successful database write — the row is the
 * source of truth and the sync is reported as a warning the user can retry.
 */

import { refresh, updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { formatCents } from '@lensello/core';
import { getIntegrations } from '@lensello/core/integrations';
import { requireUser, type Session } from '@/lib/auth';
import {
  EMPTY_PAYMENT_STATE,
  EMPTY_STATUS_STATE,
  emptyGigFormState,
  type ConflictSummary,
  type GigFormState,
  type PaymentActionState,
  type PaymentKind,
  type StatusActionState,
} from '@/lib/gigs/action-state';
import {
  findConflictingGigs,
  getGig,
  listGigTasks,
  nextTaskPosition,
} from '@/lib/gigs/queries';
import {
  canTransition,
  gigPatch,
  isBlockingStatus,
  isGigStatus,
  outstandingCents,
  type GigInsert,
  type GigRow,
  type GigUpdate,
} from '@/lib/gigs/types';
import { parseGigForm, readGigForm } from '@/lib/gigs/validation';

type Db = Session['supabase'];

// --- helpers -------------------------------------------------------------

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function toConflict(gig: GigRow): ConflictSummary {
  return {
    id: gig.id,
    title: gig.title,
    startsAt: gig.starts_at,
    endsAt: gig.ends_at,
    status: gig.status,
  };
}

function invalidate(gigId?: string): void {
  // updateTag rather than revalidateTag: the photographer must see their own
  // write immediately, not stale-while-revalidate.
  updateTag('gigs');
  if (gigId) updateTag(`gig-${gigId}`);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Bring the external calendar in line with the stored gig.
 *
 * A gig has an event when it is `confirmed`. A `completed` gig keeps the event
 * it already had (it happened), but never gains one. Everything else — inquiry,
 * hold, cancelled — has no event, so demoting a confirmed gig removes the
 * booking from the shared calendar instead of leaving a lie on it.
 *
 * Returns a warning string when the adapter failed; the row is already saved.
 */
async function reconcileCalendar(supabase: Db, gig: GigRow): Promise<string | null> {
  const { calendar } = getIntegrations();
  const shouldHaveEvent =
    gig.status === 'confirmed' ||
    (gig.status === 'completed' && gig.calendar_event_id !== null);

  try {
    if (shouldHaveEvent) {
      const event = {
        title: gig.title,
        startsAt: gig.starts_at,
        endsAt: gig.ends_at,
        location: gig.location,
      };

      if (gig.calendar_event_id) {
        await calendar.updateEvent(gig.calendar_event_id, event);
        return null;
      }

      const created = await calendar.createEvent(event);
      const { error } = await supabase
        .from('gigs')
        .update(gigPatch({ calendar_event_id: created.externalId }))
        .eq('id', gig.id);
      if (error) {
        return `The calendar event was created but its id could not be saved (${error.message}). Re-confirming the gig may create a duplicate event.`;
      }
      return null;
    }

    if (gig.calendar_event_id) {
      await calendar.deleteEvent(gig.calendar_event_id);
      await supabase
        .from('gigs')
        .update(gigPatch({ calendar_event_id: null }))
        .eq('id', gig.id);
    }
    return null;
  } catch (error) {
    return `Calendar sync failed: ${errorMessage(error, 'the calendar provider did not respond')}. The gig is saved — try the status change again to retry the sync.`;
  }
}

// --- create / edit -------------------------------------------------------

/**
 * Create or update a gig. `gigId` present means update.
 *
 * Double booking is a warning, not a wall: if the new times overlap an existing
 * `hold`/`confirmed` gig the save stops and reports the clash, and the same
 * submission with `override=1` goes through. Photographers do genuinely double
 * book (second shooter, two nearby sessions), so silently blocking would be
 * wrong — and so would silently allowing.
 */
export async function saveGig(
  _prev: GigFormState,
  formData: FormData,
): Promise<GigFormState> {
  const { supabase } = await requireUser();

  const values = readGigForm(formData);
  const gigId = field(formData, 'gigId') || null;
  const override = field(formData, 'override') === '1';

  const parsed = parseGigForm(values);
  if (!parsed.ok) {
    return { ...emptyGigFormState(values), phase: 'error', errors: parsed.errors };
  }
  const gig = parsed.gig;

  // An existing gig must exist before we claim to have updated it.
  let existing: GigRow | null = null;
  if (gigId) {
    existing = await getGig(supabase, gigId);
    if (!existing) {
      return {
        ...emptyGigFormState(values),
        phase: 'error',
        formError: 'That gig no longer exists. It may have been deleted in another tab.',
      };
    }
  }

  // The status dropdown is not a back door around the transition rules. The
  // detail form and the status panel enforce the same graph, so a POST naming
  // "completed" on an inquiry is rejected in both places. A brand-new gig can be
  // created at any status, because back-filling last year's wedding is normal.
  if (existing && gig.status !== existing.status && !canTransition(existing.status, gig.status)) {
    return {
      ...emptyGigFormState(values),
      phase: 'error',
      errors: {
        status: `A gig cannot go straight from ${existing.status} to ${gig.status}. Use the status panel for the moves that are allowed from here.`,
      },
    };
  }

  if (isBlockingStatus(gig.status) && !override) {
    const conflicts = await findConflictingGigs(supabase, {
      startsAt: gig.startsAt,
      endsAt: gig.endsAt,
      excludeGigId: gigId,
    });

    if (conflicts.length > 0) {
      return {
        ...emptyGigFormState(values),
        phase: 'conflict',
        conflicts: conflicts.map(toConflict),
      };
    }
  }

  const payload = {
    client_id: gig.clientId,
    title: gig.title,
    type: gig.type,
    status: gig.status,
    starts_at: gig.startsAt,
    ends_at: gig.endsAt,
    location: gig.location,
    price_cents: gig.priceCents,
    deposit_cents: gig.depositCents,
    notes: gig.notes,
  };

  let saved: GigRow;

  if (existing) {
    const { data, error } = await supabase
      .from('gigs')
      .update(payload satisfies GigUpdate)
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error || !data) {
      return {
        ...emptyGigFormState(values),
        phase: 'error',
        formError: `Could not save the gig: ${error?.message ?? 'no row came back'}`,
      };
    }
    saved = data as GigRow;
  } else {
    const { data, error } = await supabase
      .from('gigs')
      .insert(payload satisfies GigInsert)
      .select('*')
      .single();

    if (error || !data) {
      return {
        ...emptyGigFormState(values),
        phase: 'error',
        formError: `Could not create the gig: ${error?.message ?? 'no row came back'}`,
      };
    }
    saved = data as GigRow;
  }

  const warning = await reconcileCalendar(supabase, saved);

  invalidate(saved.id);

  if (!existing) {
    // New gig: land the user on its detail page.
    redirect(`/gigs/${saved.id}`);
  }

  refresh();
  return { ...emptyGigFormState(values), phase: 'saved', warning };
}

// --- status transitions --------------------------------------------------

export async function setGigStatus(
  _prev: StatusActionState,
  formData: FormData,
): Promise<StatusActionState> {
  const { supabase } = await requireUser();

  const gigId = field(formData, 'gigId');
  const next = field(formData, 'status');
  const override = field(formData, 'override') === '1';

  if (!isGigStatus(next)) {
    return { ...EMPTY_STATUS_STATE, phase: 'error', message: 'That is not a gig status.' };
  }

  const gig = await getGig(supabase, gigId);
  if (!gig) {
    return { ...EMPTY_STATUS_STATE, phase: 'error', message: 'That gig no longer exists.' };
  }

  if (gig.status === next) {
    return { ...EMPTY_STATUS_STATE, phase: 'done', message: `Already ${next}.` };
  }

  if (!canTransition(gig.status, next)) {
    return {
      ...EMPTY_STATUS_STATE,
      phase: 'error',
      message: `A gig cannot go straight from ${gig.status} to ${next}.`,
    };
  }

  if (isBlockingStatus(next) && !override) {
    const conflicts = await findConflictingGigs(supabase, {
      startsAt: gig.starts_at,
      endsAt: gig.ends_at,
      excludeGigId: gig.id,
    });

    if (conflicts.length > 0) {
      return {
        phase: 'conflict',
        message: null,
        conflicts: conflicts.map(toConflict),
        pendingStatus: next,
      };
    }
  }

  const { data, error } = await supabase
    .from('gigs')
    .update({ status: next } satisfies GigUpdate)
    .eq('id', gig.id)
    .select('*')
    .single();

  if (error || !data) {
    return {
      ...EMPTY_STATUS_STATE,
      phase: 'error',
      message: `Could not change the status: ${error?.message ?? 'no row came back'}`,
    };
  }

  const warning = await reconcileCalendar(supabase, data as GigRow);

  invalidate(gig.id);
  refresh();

  return {
    ...EMPTY_STATUS_STATE,
    phase: 'done',
    message: warning ?? `Status changed to ${next}.`,
  };
}

// --- checklist -----------------------------------------------------------

/**
 * Tasks are scoped by `gig_id` on every write. Passing only a task id would let
 * a direct POST toggle a task on a gig the caller never opened; RLS would allow
 * it because all staff can see all gigs, so the scoping is about coherence
 * rather than secrecy — but a mutation that can touch an arbitrary row from a
 * gig's page is still a bug.
 */
export async function addGigTask(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const gigId = field(formData, 'gigId');
  const label = field(formData, 'label');
  if (!gigId || !label) return;

  const position = await nextTaskPosition(supabase, gigId);
  const { error } = await supabase
    .from('gig_tasks')
    .insert({ gig_id: gigId, label, position });

  if (error) throw new Error(`Could not add the task: ${error.message}`);

  invalidate(gigId);
  refresh();
}

export async function renameGigTask(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const gigId = field(formData, 'gigId');
  const taskId = field(formData, 'taskId');
  const label = field(formData, 'label');
  if (!gigId || !taskId || !label) return;

  const { error } = await supabase
    .from('gig_tasks')
    .update({ label })
    .eq('id', taskId)
    .eq('gig_id', gigId);

  if (error) throw new Error(`Could not rename the task: ${error.message}`);

  invalidate(gigId);
  refresh();
}

export async function toggleGigTask(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const gigId = field(formData, 'gigId');
  const taskId = field(formData, 'taskId');
  if (!gigId || !taskId) return;

  // Read the current value rather than trusting a posted one, so a stale form
  // cannot flip a task that someone else already ticked.
  const { data: task, error: readError } = await supabase
    .from('gig_tasks')
    .select('id, is_done')
    .eq('id', taskId)
    .eq('gig_id', gigId)
    .maybeSingle();

  if (readError) throw new Error(`Could not read the task: ${readError.message}`);
  if (!task) return;

  const { error } = await supabase
    .from('gig_tasks')
    .update({ is_done: !task.is_done })
    .eq('id', task.id)
    .eq('gig_id', gigId);

  if (error) throw new Error(`Could not update the task: ${error.message}`);

  invalidate(gigId);
  refresh();
}

export async function deleteGigTask(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const gigId = field(formData, 'gigId');
  const taskId = field(formData, 'taskId');
  if (!gigId || !taskId) return;

  const { error } = await supabase
    .from('gig_tasks')
    .delete()
    .eq('id', taskId)
    .eq('gig_id', gigId);

  if (error) throw new Error(`Could not delete the task: ${error.message}`);

  invalidate(gigId);
  refresh();
}

/**
 * Reorder by swapping `position` with the adjacent task.
 *
 * Positions are rewritten from the current order first, because 0001 defaults
 * every `position` to 0 — a checklist seeded elsewhere can arrive with all
 * positions equal, and swapping two zeroes achieves nothing.
 */
export async function moveGigTask(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const gigId = field(formData, 'gigId');
  const taskId = field(formData, 'taskId');
  const direction = field(formData, 'direction');
  if (!gigId || !taskId || (direction !== 'up' && direction !== 'down')) return;

  const tasks = await listGigTasks(supabase, gigId);
  const index = tasks.findIndex((task) => task.id === taskId);
  if (index === -1) return;

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= tasks.length) return;

  const reordered = [...tasks];
  const moved = reordered[targetIndex]!;
  reordered[targetIndex] = reordered[index]!;
  reordered[index] = moved;

  // Renumber densely from 0; cheap for a checklist and immune to duplicates.
  for (const [position, task] of reordered.entries()) {
    if (task.position === position) continue;
    const { error } = await supabase
      .from('gig_tasks')
      .update({ position })
      .eq('id', task.id)
      .eq('gig_id', gigId);
    if (error) throw new Error(`Could not reorder the checklist: ${error.message}`);
  }

  invalidate(gigId);
  refresh();
}

// --- deposits and balances ----------------------------------------------

function paymentAmountCents(gig: GigRow, kind: PaymentKind): number {
  return kind === 'deposit' ? gig.deposit_cents : outstandingCents(gig);
}

async function clientEmailFor(supabase: Db, gig: GigRow): Promise<string | null> {
  if (!gig.client_id) return null;
  const { data } = await supabase
    .from('clients')
    .select('email')
    .eq('id', gig.client_id)
    .maybeSingle();
  return data?.email ?? null;
}

/** Ask the payment adapter for a hosted checkout link and remember it. */
export async function requestGigPayment(
  _prev: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  const { supabase } = await requireUser();

  const gigId = field(formData, 'gigId');
  const kind = field(formData, 'kind') as PaymentKind;
  if (kind !== 'deposit' && kind !== 'balance') {
    return { ...EMPTY_PAYMENT_STATE, phase: 'error', message: 'Unknown payment type.' };
  }

  const gig = await getGig(supabase, gigId);
  if (!gig) {
    return { ...EMPTY_PAYMENT_STATE, phase: 'error', kind, message: 'That gig no longer exists.' };
  }

  const alreadyPaid = kind === 'deposit' ? gig.deposit_paid_at : gig.balance_paid_at;
  if (alreadyPaid) {
    return {
      ...EMPTY_PAYMENT_STATE,
      phase: 'error',
      kind,
      message: `The ${kind} is already marked paid.`,
    };
  }

  if (kind === 'balance' && !gig.deposit_paid_at && gig.deposit_cents > 0) {
    return {
      ...EMPTY_PAYMENT_STATE,
      phase: 'error',
      kind,
      message: 'Collect the deposit before requesting the balance.',
    };
  }

  const amountCents = paymentAmountCents(gig, kind);
  if (amountCents <= 0) {
    return {
      ...EMPTY_PAYMENT_STATE,
      phase: 'error',
      kind,
      message:
        kind === 'deposit'
          ? 'This gig has no deposit set. Add one on the gig first.'
          : 'There is no balance outstanding on this gig.',
    };
  }

  let request;
  try {
    // Never fetch Stripe directly — the adapter is the only route out.
    const { payments } = getIntegrations();
    request = await payments.requestPayment({
      gigId: gig.id,
      amountCents,
      description: `${gig.title} — ${kind}`,
      clientEmail: await clientEmailFor(supabase, gig),
    });
  } catch (error) {
    return {
      ...EMPTY_PAYMENT_STATE,
      phase: 'error',
      kind,
      message: `Could not create the payment request: ${errorMessage(error, 'the payment provider did not respond')}`,
    };
  }

  const patch: GigUpdate =
    kind === 'deposit'
      ? { deposit_payment_id: request.externalId, deposit_payment_url: request.url }
      : { balance_payment_id: request.externalId, balance_payment_url: request.url };

  const { error } = await supabase.from('gigs').update(gigPatch(patch)).eq('id', gig.id);
  if (error) {
    return {
      phase: 'error',
      kind,
      url: request.url,
      paymentStatus: request.status,
      message: `The checkout link was created but could not be saved (${error.message}). Copy it now — it will not be here after a reload.`,
    };
  }

  invalidate(gig.id);
  refresh();

  return {
    phase: 'done',
    kind,
    url: request.url,
    paymentStatus: request.status,
    message: `${formatCents(amountCents)} ${kind} link ready. Send it to the client.`,
  };
}

/**
 * Poll the adapter for a request's status and, when it comes back `paid`, stamp
 * `deposit_paid_at` / `balance_paid_at`. The timestamp is only ever set from a
 * provider-confirmed `paid`, never from the button being pressed.
 */
export async function checkGigPayment(
  _prev: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  const { supabase } = await requireUser();

  const gigId = field(formData, 'gigId');
  const kind = field(formData, 'kind') as PaymentKind;
  if (kind !== 'deposit' && kind !== 'balance') {
    return { ...EMPTY_PAYMENT_STATE, phase: 'error', message: 'Unknown payment type.' };
  }

  const gig = await getGig(supabase, gigId);
  if (!gig) {
    return { ...EMPTY_PAYMENT_STATE, phase: 'error', kind, message: 'That gig no longer exists.' };
  }

  const externalId = kind === 'deposit' ? gig.deposit_payment_id : gig.balance_payment_id;
  if (!externalId) {
    return {
      ...EMPTY_PAYMENT_STATE,
      phase: 'error',
      kind,
      message: `No ${kind} request has been sent yet, so there is nothing to check.`,
    };
  }

  let payment;
  try {
    const { payments } = getIntegrations();
    payment = await payments.getPayment(externalId);
  } catch (error) {
    return {
      ...EMPTY_PAYMENT_STATE,
      phase: 'error',
      kind,
      message: `Could not reach the payment provider: ${errorMessage(error, 'no response')}`,
    };
  }

  if (payment.status !== 'paid') {
    return {
      phase: 'done',
      kind,
      url: payment.url,
      paymentStatus: payment.status,
      message: `The ${kind} is still ${payment.status}.`,
    };
  }

  const alreadyStamped = kind === 'deposit' ? gig.deposit_paid_at : gig.balance_paid_at;
  if (!alreadyStamped) {
    const paidAt = new Date().toISOString();
    const patch: GigUpdate =
      kind === 'deposit' ? { deposit_paid_at: paidAt } : { balance_paid_at: paidAt };

    const { error } = await supabase.from('gigs').update(gigPatch(patch)).eq('id', gig.id);
    if (error) {
      return {
        phase: 'error',
        kind,
        url: payment.url,
        paymentStatus: payment.status,
        message: `The provider says paid, but recording it failed: ${error.message}`,
      };
    }
  }

  invalidate(gig.id);
  refresh();

  return {
    phase: 'done',
    kind,
    url: payment.url,
    paymentStatus: 'paid',
    message: `${formatCents(payment.amountCents)} ${kind} received.`,
  };
}

// --- completion handoff to the library ----------------------------------

/**
 * Create the `shoots` row for a completed gig.
 *
 * Insert only, and only the columns a gig can speak for. The library module owns
 * everything else about a shoot — culling, assets, cover image — so this hands
 * over a stub and stops.
 */
export async function createShootForGig(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const gigId = field(formData, 'gigId');
  if (!gigId) return;

  const gig = await getGig(supabase, gigId);
  if (!gig) throw new Error('That gig no longer exists.');

  const { data: alreadyLinked } = await supabase
    .from('shoots')
    .select('id')
    .eq('gig_id', gig.id)
    .limit(1)
    .maybeSingle();

  if (alreadyLinked) {
    invalidate(gig.id);
    refresh();
    return;
  }

  const { error } = await supabase.from('shoots').insert({
    title: gig.title,
    type: gig.type,
    // The gig is done, so the photos exist but nothing has been culled yet.
    status: 'shot',
    client_id: gig.client_id,
    gig_id: gig.id,
    shot_at: gig.starts_at,
    location: gig.location,
  });

  if (error) throw new Error(`Could not create the shoot: ${error.message}`);

  invalidate(gig.id);
  refresh();
}

/** Point an existing unlinked shoot at this gig. Touches only `gig_id`. */
export async function linkShootToGig(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const gigId = field(formData, 'gigId');
  const shootId = field(formData, 'shootId');
  if (!gigId || !shootId) return;

  const gig = await getGig(supabase, gigId);
  if (!gig) throw new Error('That gig no longer exists.');

  const { error } = await supabase
    .from('shoots')
    .update({ gig_id: gig.id })
    .eq('id', shootId)
    // Refuse to steal a shoot that already belongs to another gig.
    .is('gig_id', null);

  if (error) throw new Error(`Could not link the shoot: ${error.message}`);

  invalidate(gig.id);
  refresh();
}

// --- delete --------------------------------------------------------------

/**
 * Hard delete, for a gig entered by mistake. Cancelling is the normal path —
 * it keeps the record and the client history. `gig_tasks` cascade; a linked
 * `shoots` row survives with `gig_id` set to null by its FK.
 */
export async function deleteGig(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const gigId = field(formData, 'gigId');
  if (!gigId) return;

  const gig = await getGig(supabase, gigId);
  if (!gig) redirect('/gigs');

  if (gig.calendar_event_id) {
    try {
      await getIntegrations().calendar.deleteEvent(gig.calendar_event_id);
    } catch {
      // The row is going regardless; a stranded mock event is not worth
      // blocking the delete over.
    }
  }

  const { error } = await supabase.from('gigs').delete().eq('id', gig.id);
  if (error) throw new Error(`Could not delete the gig: ${error.message}`);

  invalidate(gig.id);
  redirect('/gigs');
}
