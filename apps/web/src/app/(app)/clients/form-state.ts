import type { ClientStage } from '@lensello/core';

/**
 * Result shapes and their initial values for this module's Server Actions.
 *
 * Outside `actions.ts` because a `'use server'` module may only export async
 * functions: every export in one becomes an HTTP endpoint, so a plain object
 * is rejected at runtime with "a 'use server' file can only export async
 * functions, found object". The page 500s and the build says nothing, because
 * it is not a build-time error.
 */

export interface SyncState {
  summary: string | null;
  error: string | null;
  /** Changes on every run so the UI can react even to an identical result. */
  token: number;
}

export const INITIAL_SYNC: SyncState = { summary: null, error: null, token: 0 };

export interface RecordState {
  saved: boolean;
  error: string | null;
  token: number;
}

export const INITIAL_RECORD: RecordState = { saved: false, error: null, token: 0 };

export interface StageState {
  error: string | null;
  token: number;
}

export const INITIAL_STAGE: StageState = { error: null, token: 0 };

export interface HandledState {
  error: string | null;
  token: number;
}

export const INITIAL_HANDLED: HandledState = { error: null, token: 0 };

export interface SendState {
  sent: boolean;
  error: string | null;
  /** Offered, not applied, once a reply has gone out. */
  suggestedStage: ClientStage | null;
  token: number;
  /**
   * Successful sends only.
   *
   * The composer uses this as a React `key`, which is what clears it after a
   * send: the subtree remounts and its state resets. `token` would be wrong for
   * that — it changes on failures too, and a failed send must not throw away
   * what the photographer typed.
   */
  sentCount: number;
}

export const INITIAL_SEND: SendState = {
  sent: false,
  error: null,
  suggestedStage: null,
  token: 0,
  sentCount: 0,
};

export interface EraseState {
  error: string | null;
  message: string | null;
}

export const ERASE_IDLE: EraseState = { error: null, message: null };
