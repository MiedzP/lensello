/**
 * The result shape shared by every automations Server Action.
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

/** Returned once, at key creation, and never again — see `api-keys.ts`. */
export interface CreateKeyState extends ActionState {
  /** The raw key. Present only immediately after minting; never re-derivable. */
  mintedKey: string | null;
}

export const IDLE_KEY_STATE: CreateKeyState = { error: null, message: null, mintedKey: null };
