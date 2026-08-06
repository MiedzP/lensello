/**
 * The default agreement, rendered from a gig.
 *
 * A starting point the photographer edits before sending, not a finished legal
 * document — it is deliberately plain, covers what actually causes disputes in
 * photography work, and says in the UI that it is not legal advice.
 *
 * Rendered once and then snapshotted onto the contract row. Changing anything
 * here affects only contracts created afterwards, which is the whole point.
 */

import { SHOOT_TYPE_LABELS, formatCents, type ShootType } from '@lensello/core';

export interface ContractInput {
  studioName: string;
  clientName: string;
  gigTitle: string;
  gigType: ShootType;
  startsAt: string;
  endsAt: string;
  location: string | null;
  priceCents: number;
  depositCents: number;
}

function formatWindow(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'To be confirmed';
  }

  const date = start.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const time = (value: Date) =>
    value.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  return `${date}, ${time(start)} to ${time(end)}`;
}

export function renderContract(input: ContractInput): string {
  const balanceCents = Math.max(0, input.priceCents - input.depositCents);

  return `PHOTOGRAPHY AGREEMENT

Between ${input.studioName} ("the Photographer") and ${input.clientName} ("the Client").

1. THE WORK
${SHOOT_TYPE_LABELS[input.gigType]} photography: ${input.gigTitle}.
When: ${formatWindow(input.startsAt, input.endsAt)}
Where: ${input.location ?? 'To be confirmed'}

2. FEE AND PAYMENT
Total fee: ${formatCents(input.priceCents)}
Deposit due on booking: ${formatCents(input.depositCents)}
Balance due before delivery: ${formatCents(balanceCents)}

The booking is held only once the deposit is received. The deposit is
non-refundable, because the Photographer turns away other work for the date.

3. CANCELLATION
If the Client cancels, the deposit is retained. If the Client cancels within 14
days of the date, the full fee remains payable.

If the Photographer cannot attend through illness, accident, or other cause
beyond their control, they will make reasonable efforts to find a replacement
of comparable standard. If none can be found, all monies paid are refunded in
full. The Photographer's liability is limited to the fees paid.

4. DELIVERY
Edited photographs are delivered through a private online gallery. The
Photographer selects and edits the images at their professional discretion;
the Client is not entitled to unedited or rejected frames.

5. COPYRIGHT AND USE
The Photographer retains copyright in all images. The Client is granted a
perpetual, non-exclusive licence to use the delivered images for personal,
non-commercial purposes, including printing and sharing.

The Photographer may use the images to promote their work — portfolio, website,
social media, competitions — unless the Client withholds permission in writing
before the shoot.

6. THE CLIENT'S PART
The Client will ensure the Photographer has access to the locations, and will
identify anyone whose photograph is essential. The Photographer cannot be held
responsible for images not taken because a person or item was not made
available.

7. DATA
Personal data is held to perform this agreement and is handled in line with UK
data protection law. Images are retained for the Photographer's own archive and
promotional use as set out above.

8. GOVERNING LAW
This agreement is governed by the law of England and Wales.

By typing their name below, the Client confirms they have read and agree to
these terms.`;
}
