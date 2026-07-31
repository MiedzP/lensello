/** Client funnel vocabulary: labels, badge tones, and the next sensible step. */

import type { ClientSource, ClientStage } from '@lensello/core';
import type { Tone } from '@/components/ui';

/** Human labels for `clients.source`, mirroring CLIENT_SOURCES in core. */
export const CLIENT_SOURCE_LABELS: Record<ClientSource, string> = {
  instagram: 'Instagram',
  referral: 'Referral',
  website: 'Website',
  google: 'Google',
  wedding_wire: 'WeddingWire',
  repeat: 'Repeat client',
  other: 'Other',
};

/**
 * Badge tone per stage, so a list scans without reading every label: neutral at
 * the cold end, accent and warning while it is live, green once it is money,
 * red when it is gone.
 */
export const CLIENT_STAGE_TONES: Record<ClientStage, Tone> = {
  lead: 'neutral',
  inquiry: 'accent',
  quoted: 'warning',
  booked: 'success',
  completed: 'neutral',
  lost: 'danger',
};

/**
 * The stage a reply usually moves someone to.
 *
 * Only ever *offered* after a reply goes out — never applied automatically.
 * Answering a booked client's question about parking should not quietly mark
 * them completed, which is why the tail of the funnel returns null.
 */
export function suggestNextStage(stage: ClientStage): ClientStage | null {
  switch (stage) {
    case 'lead':
      return 'inquiry';
    case 'inquiry':
      return 'quoted';
    case 'quoted':
      return 'booked';
    default:
      return null;
  }
}
