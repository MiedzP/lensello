/**
 * Loop protection, kept pure and separate so it can be tested without a
 * database.
 *
 * The runaway scenario the brief calls out: automation A's `update_client_stage`
 * step moves a client to "booked", which is itself the trigger for automation
 * B (or A again). Without a guard, that chain either cycles forever or drifts
 * into "every automation on the workspace fires once per event", both of which
 * end with a client getting a burst of emails. Two independent limits catch
 * both shapes of the problem:
 *
 *  - `hasCycle`: the exact same automation id reappears in its own causation
 *    chain — A caused B caused A. Stops on the first repeat, not the second,
 *    because a "loop that only runs twice" is still the bug.
 *  - `MAX_CHAIN_DEPTH`: a chain of *different* automations chained end to end.
 *    No cycle, but five hops deep is already further than any legitimate
 *    workflow needs, and a long chain is exactly as capable of ending in a
 *    burst of client messages as a cycle is.
 */

import { MAX_CHAIN_DEPTH } from './types';

export function hasCycle(chain: readonly string[], automationId: string): boolean {
  return chain.includes(automationId);
}

export function isTooDeep(chain: readonly string[]): boolean {
  return chain.length >= MAX_CHAIN_DEPTH;
}

export { MAX_CHAIN_DEPTH };
