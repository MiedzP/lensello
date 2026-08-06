/**
 * The single result shape every connections Server Action returns.
 *
 * Lives outside `actions.ts` because a `'use server'` module may only export
 * async functions — a shared constant there is a build error.
 */
export interface ActionState {
  error: string | null;
  message: string | null;
}

export const IDLE: ActionState = { error: null, message: null };

export function failed(error: string): ActionState {
  return { error, message: null };
}

export function ok(message: string): ActionState {
  return { error: null, message };
}
