/**
 * Whether a contract can be signed, and why not.
 *
 * A pure function taking `now` rather than reading the clock itself: the page
 * calling this renders on the server, and reading the clock during render is
 * both a React purity violation and untestable. Passing the instant in makes
 * the expiry boundary something a test can sit exactly on.
 */

export type ContractProblem = 'draft' | 'void' | 'expired';

export interface ContractAccess {
  status: 'draft' | 'sent' | 'accepted' | 'void';
  expires_at: string | null;
}

export function contractProblem(
  contract: ContractAccess,
  now: number,
): ContractProblem | null {
  if (contract.status === 'void') return 'void';
  if (contract.status === 'draft') return 'draft';

  // An accepted contract never expires. Expiry is a deadline to sign by, and
  // once it has been signed the deadline has been met — showing "expired" on
  // an agreement somebody already accepted would be alarming and wrong.
  if (contract.status === 'accepted') return null;

  if (contract.expires_at && new Date(contract.expires_at).getTime() <= now) {
    return 'expired';
  }
  return null;
}
