/**
 * Recording consequential actions.
 *
 * The trail is append-only at the database level — `audit_events` has select
 * and insert policies and deliberately no update or delete. That is what makes
 * it evidence rather than a log.
 *
 * Writing an audit row must never fail the action it describes. An erasure
 * that succeeded but was not recorded is a gap in the trail; an erasure that
 * was refused because the trail could not be written is a data-subject request
 * you failed to honour. The first is recoverable, the second is not.
 */

import type { Session } from '@/lib/auth';
import type { Json } from '@/lib/db.types';

type Supabase = Session['supabase'];

export type AuditAction =
  | 'client.erased'
  | 'client.exported'
  | 'client.consent_recorded'
  | 'mailbox.connected'
  | 'mailbox.disconnected'
  | 'social.connected'
  | 'social.disconnected'
  | 'account.removed';

export interface AuditInput {
  action: AuditAction;
  subjectType: 'client' | 'mailbox' | 'social_account' | 'account';
  subjectId: string | null;
  /**
   * Enough to prove what happened, never enough to reconstruct what was
   * deleted — putting the erased data in the audit trail would defeat the
   * erasure it records.
   */
  detail?: Record<string, string | number | boolean | null>;
}

export async function recordAudit(
  supabase: Supabase,
  actor: { id: string; email: string | null },
  input: AuditInput,
): Promise<void> {
  try {
    const { error } = await supabase.from('audit_events').insert({
      actor_id: actor.id,
      // Denormalised: the profile may be deleted later and "who did this" has
      // to survive that.
      actor_email: actor.email,
      action: input.action,
      subject_type: input.subjectType,
      subject_id: input.subjectId,
      detail: (input.detail ?? {}) as Json,
    });

    if (error) {
      console.error('[audit] could not record event', input.action, error.message);
    }
  } catch (cause) {
    console.error('[audit] could not record event', input.action, cause);
  }
}
