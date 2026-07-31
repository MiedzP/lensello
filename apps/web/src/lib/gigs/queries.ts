/**
 * Read helpers for the gigs module.
 *
 * Every query goes through the caller's Supabase client, so RLS applies. These
 * are called from Server Components and from Server Actions that have already
 * resolved a user.
 *
 * Clients and shoots are read here but never written by these helpers — those
 * tables belong to other modules. Joins are done in JS rather than with
 * Supabase's embedded-resource syntax because `db.types.ts` declares
 * `Relationships: []`, so an embedded select does not type-check.
 */

import type { GigStatus } from '@lensello/core';
import type { Session } from '@/lib/auth';
import {
  BLOCKING_STATUSES,
  type ClientRef,
  type GigRow,
  type GigTaskRow,
  type ShootRef,
} from './types';
import { intervalsOverlap } from './validation';

type Db = Session['supabase'];

/** `select('*')` picks up the 0005 columns without naming them. */
const ALL = '*';

function asGigs(rows: unknown): GigRow[] {
  // Cast at the query boundary: the shared generated types do not yet know
  // about the columns added in 20260731150400_gigs.sql.
  return (rows ?? []) as GigRow[];
}

function fail(context: string, error: { message: string } | null): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

// --- gigs ----------------------------------------------------------------

/**
 * Gigs that overlap `[fromIso, toIso)` — not merely those that start inside it,
 * so a multi-day wedding still shows on every day it covers.
 */
export async function listGigsOverlapping(
  supabase: Db,
  fromIso: string,
  toIso: string,
  status?: GigStatus,
): Promise<GigRow[]> {
  let query = supabase
    .from('gigs')
    .select(ALL)
    .lt('starts_at', toIso)
    .gt('ends_at', fromIso)
    .order('starts_at', { ascending: true });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  fail('Could not load the calendar', error);
  return asGigs(data);
}

export interface GigListBuckets {
  upcoming: GigRow[];
  past: GigRow[];
}

/**
 * List view data: upcoming soonest-first, then everything already finished
 * most-recent-first. A single query, split in memory — the studio's gig count
 * is in the hundreds, not the millions.
 */
export async function listGigs(
  supabase: Db,
  options: { status?: GigStatus; nowIso?: string } = {},
): Promise<GigListBuckets> {
  const now = options.nowIso ?? new Date().toISOString();

  let query = supabase.from('gigs').select(ALL).order('starts_at', { ascending: true });
  if (options.status) query = query.eq('status', options.status);

  const { data, error } = await query;
  fail('Could not load gigs', error);
  const gigs = asGigs(data);

  const upcoming = gigs.filter((gig) => gig.ends_at >= now);
  const past = gigs.filter((gig) => gig.ends_at < now).reverse();
  return { upcoming, past };
}

export async function getGig(supabase: Db, gigId: string): Promise<GigRow | null> {
  const { data, error } = await supabase
    .from('gigs')
    .select(ALL)
    .eq('id', gigId)
    .maybeSingle();

  fail('Could not load the gig', error);
  return data ? (data as GigRow) : null;
}

/**
 * Double-booking check.
 *
 * Overlap is `new.starts_at < existing.ends_at AND new.ends_at > existing.starts_at`.
 * Both comparisons are strict, so a gig ending at exactly the moment another
 * starts is not a conflict — back-to-back bookings are normal, not an error.
 * Only `hold` and `confirmed` gigs hold a slot; an inquiry is not a commitment.
 *
 * Postgres narrows the candidates, then `intervalsOverlap` re-checks them. The
 * second pass is not redundant: it means the boundary rule lives in exactly one
 * place (`validation.ts`), and a candidate row cannot slip through on some
 * difference between Postgres' timestamptz comparison and ours.
 */
export async function findConflictingGigs(
  supabase: Db,
  input: { startsAt: string; endsAt: string; excludeGigId?: string | null },
): Promise<GigRow[]> {
  let query = supabase
    .from('gigs')
    .select(ALL)
    .in('status', [...BLOCKING_STATUSES])
    .lt('starts_at', input.endsAt)
    .gt('ends_at', input.startsAt)
    .order('starts_at', { ascending: true });

  if (input.excludeGigId) query = query.neq('id', input.excludeGigId);

  const { data, error } = await query;
  fail('Could not check for double bookings', error);

  return asGigs(data).filter((gig) =>
    intervalsOverlap(input, { startsAt: gig.starts_at, endsAt: gig.ends_at }),
  );
}

// --- tasks ---------------------------------------------------------------

export async function listGigTasks(supabase: Db, gigId: string): Promise<GigTaskRow[]> {
  const { data, error } = await supabase
    .from('gig_tasks')
    .select('*')
    .eq('gig_id', gigId)
    .order('position', { ascending: true })
    .order('id', { ascending: true });

  fail('Could not load the checklist', error);
  return data ?? [];
}

/** Next free position, so a new task lands at the bottom. */
export async function nextTaskPosition(supabase: Db, gigId: string): Promise<number> {
  const { data, error } = await supabase
    .from('gig_tasks')
    .select('position')
    .eq('gig_id', gigId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  fail('Could not work out the checklist order', error);
  return data ? data.position + 1 : 0;
}

// --- clients (read-only; owned by the clients module) --------------------

export async function listClientRefs(supabase: Db): Promise<ClientRef[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, email')
    .order('name', { ascending: true });

  fail('Could not load clients', error);
  return data ?? [];
}

/** Client lookup for a set of gigs, so list rows can show a name. */
export async function mapClientsById(
  supabase: Db,
  clientIds: readonly (string | null)[],
): Promise<Map<string, ClientRef>> {
  const ids = [...new Set(clientIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map();

  const { data, error } = await supabase
    .from('clients')
    .select('id, name, email')
    .in('id', ids);

  fail('Could not load clients', error);
  return new Map((data ?? []).map((client) => [client.id, client]));
}

// --- shoots (read-only + the completion handoff) -------------------------

export async function getShootForGig(supabase: Db, gigId: string): Promise<ShootRef | null> {
  const { data, error } = await supabase
    .from('shoots')
    .select('id, title, status, shot_at')
    .eq('gig_id', gigId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  fail('Could not check for a linked shoot', error);
  return data ?? null;
}

/** Candidates for "link an existing shoot": those not already tied to a gig. */
export async function listUnlinkedShoots(supabase: Db, limit = 25): Promise<ShootRef[]> {
  const { data, error } = await supabase
    .from('shoots')
    .select('id, title, status, shot_at')
    .is('gig_id', null)
    .order('shot_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  fail('Could not load shoots', error);
  return data ?? [];
}
