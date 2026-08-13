/**
 * Result shape for this module's Server Actions.
 *
 * Outside `actions.ts` because a `'use server'` file may only export async
 * functions — every export becomes an HTTP endpoint, so a plain object export
 * fails at runtime, not at build time.
 */

export interface PortalState {
  error: string | null;
  message: string | null;
}

export const PORTAL_IDLE: PortalState = { error: null, message: null };
