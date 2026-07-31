/**
 * `useActionState` shapes for the gigs module.
 *
 * These live outside `actions.ts` because a `'use server'` module may only
 * export async functions — an exported constant or a synchronous helper there is
 * a build error. Keeping the state types and their initial values here lets both
 * the actions and the client components import them.
 */

import type { GigStatus } from '@lensello/core';
import type { PaymentStatus } from '@lensello/core/integrations';
import { EMPTY_GIG_VALUES, type GigFieldErrors, type GigFormValues } from './validation';

/** A gig the save would collide with, reduced to what the warning needs. */
export interface ConflictSummary {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: GigStatus;
}

export interface GigFormState {
  phase: 'idle' | 'error' | 'conflict' | 'saved';
  /** Echoed back so a rejected submit re-renders what the user typed. */
  values: GigFormValues;
  errors: GigFieldErrors;
  /** Whole-form problem, e.g. the write itself failed. */
  formError: string | null;
  conflicts: ConflictSummary[];
  /** Non-blocking follow-up, e.g. "saved, but calendar sync failed". */
  warning: string | null;
}

export function emptyGigFormState(
  values: GigFormValues = EMPTY_GIG_VALUES,
): GigFormState {
  return {
    phase: 'idle',
    values,
    errors: {},
    formError: null,
    conflicts: [],
    warning: null,
  };
}

export interface StatusActionState {
  phase: 'idle' | 'error' | 'conflict' | 'done';
  message: string | null;
  conflicts: ConflictSummary[];
  /** The status the user was trying to reach, so "do it anyway" can resend it. */
  pendingStatus: GigStatus | null;
}

export const EMPTY_STATUS_STATE: StatusActionState = {
  phase: 'idle',
  message: null,
  conflicts: [],
  pendingStatus: null,
};

export type PaymentKind = 'deposit' | 'balance';

export interface PaymentActionState {
  phase: 'idle' | 'error' | 'done';
  kind: PaymentKind | null;
  message: string | null;
  /** Hosted checkout URL to send the client. */
  url: string | null;
  paymentStatus: PaymentStatus | null;
}

export const EMPTY_PAYMENT_STATE: PaymentActionState = {
  phase: 'idle',
  kind: null,
  message: null,
  url: null,
  paymentStatus: null,
};
