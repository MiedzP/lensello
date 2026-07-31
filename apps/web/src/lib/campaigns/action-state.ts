/**
 * The single result shape every campaigns Server Action returns.
 *
 * It lives outside `actions.ts` because a `'use server'` module may only export
 * async functions — a shared constant there is a build error.
 *
 * `error` is shown as an alert, `message` as a confirmation. Both null means
 * "nothing has happened yet".
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
