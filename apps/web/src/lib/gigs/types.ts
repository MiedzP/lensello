/**
 * Gigs module row types.
 *
 * `supabase/migrations/0005_gigs.sql` adds five columns to `public.gigs` that
 * are not in the shared `@/lib/db.types` (that file is owned by the schema as a
 * whole and is being edited by nobody during this build, so it would be a merge
 * conflict waiting to happen). They are declared here and cast at the query
 * boundary in `queries.ts` instead. When the modules merge, fold
 * `GigIntegrationColumns` into `Database['public']['Tables']['gigs']` and delete
 * this indirection.
 */

import type { GigStatus } from '@lensello/core';
import { GIG_STATUSES } from '@lensello/core';
import type { Tone } from '@/components/ui';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/db.types';

/** Columns added by 0005_gigs.sql. Not yet in the shared db.types. */
export interface GigIntegrationColumns {
  /** Adapter event id. Set on confirm, cleared on cancel. */
  calendar_event_id: string | null;
  deposit_payment_id: string | null;
  deposit_payment_url: string | null;
  balance_payment_id: string | null;
  balance_payment_url: string | null;
}

export type GigRow = Tables<'gigs'> & GigIntegrationColumns;
export type GigInsert = TablesInsert<'gigs'> & Partial<GigIntegrationColumns>;
export type GigUpdate = TablesUpdate<'gigs'> & Partial<GigIntegrationColumns>;

export type GigTaskRow = Tables<'gig_tasks'>;

/**
 * The one cast the extra columns need on the write side.
 *
 * The generated `Update` type actively rejects unknown keys, so a patch touching
 * `calendar_event_id` cannot be handed to `.update()` directly. Funnelling every
 * such patch through here keeps the cast in one auditable place instead of
 * scattering `as` across the actions — and it disappears the moment the columns
 * land in the shared `db.types.ts`.
 */
export function gigPatch(patch: GigUpdate): TablesUpdate<'gigs'> {
  return patch as TablesUpdate<'gigs'>;
}

/** Just enough of a client to render a gig row without loading the CRM. */
export interface ClientRef {
  id: string;
  name: string;
  email: string | null;
}

export interface ShootRef {
  id: string;
  title: string;
  status: Tables<'shoots'>['status'];
  shot_at: string | null;
}

// --- status presentation -------------------------------------------------

export const GIG_STATUS_TONES: Record<GigStatus, Tone> = {
  inquiry: 'neutral',
  hold: 'warning',
  confirmed: 'accent',
  completed: 'success',
  cancelled: 'danger',
};

/**
 * Calendar chip styling. Semantic tokens only — a raw palette value here would
 * be invisible in dark mode.
 */
export const GIG_STATUS_CHIPS: Record<GigStatus, string> = {
  inquiry: 'bg-surface-raised text-muted',
  hold: 'bg-warning-subtle text-warning',
  confirmed: 'bg-accent-subtle text-accent',
  completed: 'bg-success-subtle text-success',
  cancelled: 'bg-danger-subtle text-danger line-through',
};

/**
 * Which statuses hold a slot on the calendar. Only these two are checked for
 * double-booking: an inquiry is not a commitment, and a cancelled or completed
 * gig cannot conflict with anything.
 */
export const BLOCKING_STATUSES: readonly GigStatus[] = ['hold', 'confirmed'];

export function isBlockingStatus(status: GigStatus): boolean {
  return BLOCKING_STATUSES.includes(status);
}

/**
 * Legal status moves. Enforced in the action, not just hidden in the UI —
 * a direct POST can name any status it likes.
 */
export const GIG_TRANSITIONS: Record<GigStatus, readonly GigStatus[]> = {
  inquiry: ['hold', 'confirmed', 'cancelled'],
  hold: ['inquiry', 'confirmed', 'cancelled'],
  confirmed: ['hold', 'completed', 'cancelled'],
  completed: ['confirmed'],
  cancelled: ['inquiry', 'hold'],
};

export function canTransition(from: GigStatus, to: GigStatus): boolean {
  return GIG_TRANSITIONS[from].includes(to);
}

export function isGigStatus(value: unknown): value is GigStatus {
  return typeof value === 'string' && (GIG_STATUSES as readonly string[]).includes(value);
}

// --- money ---------------------------------------------------------------

/** Outstanding balance: everything not covered by the deposit. Integer cents. */
export function outstandingCents(gig: Pick<GigRow, 'price_cents' | 'deposit_cents'>): number {
  return Math.max(0, gig.price_cents - gig.deposit_cents);
}

export type DepositState = 'none' | 'due' | 'requested' | 'paid';

export function depositState(
  gig: Pick<GigRow, 'deposit_cents' | 'deposit_paid_at' | 'deposit_payment_id'>,
): DepositState {
  if (gig.deposit_paid_at) return 'paid';
  if (gig.deposit_cents === 0) return 'none';
  return gig.deposit_payment_id ? 'requested' : 'due';
}

export const DEPOSIT_STATE_LABELS: Record<DepositState, string> = {
  none: 'No deposit',
  due: 'Deposit due',
  requested: 'Deposit requested',
  paid: 'Deposit paid',
};

export const DEPOSIT_STATE_TONES: Record<DepositState, Tone> = {
  none: 'neutral',
  due: 'warning',
  requested: 'accent',
  paid: 'success',
};

