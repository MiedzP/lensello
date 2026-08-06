# Lensello build plan

Phased route from what exists today to the five workflows in the Xerensys
proposal, built custom-first.

---

## What "custom-first" does and does not mean

It means Lensello owns the **data, the logic, and the interface**. There is no
GoHighLevel holding the client book, no ManyChat owning conversations, no
per-seat SaaS bill that grows with the studio.

It does not mean writing everything from nothing. Three categories stay
third-party because there is no lawful or practical alternative:

- **Card payments** — you cannot process cards yourself without PCI scope you
  do not want. Stripe is the supplier; the deposit logic, records, and UI are ours.
- **SMS** — reaching a handset needs a carrier gateway. Twilio or similar.
- **Print labs** — the lab is the manufacturer. We integrate their ordering API.

Each sits behind the existing `packages/core/src/integrations` adapter layer,
so it is swappable and never becomes the system of record.

---

## Where things actually stand

Working and deployed:

- Auth, sign-up with invite gate, staff roster with sign-in log
- `clients` CRM with stage pipeline and source attribution
- `gigs` with double-booking detection
- `shoots`/`assets` library with culling, ratings, selects, private storage
- `campaigns` with AI captions and per-platform posts
- `ads` with creative and metrics
- Public `/inquire` form: creates a lead, files a message, checks date
  availability live, sends a confirmation, alerts the studio
- Scheduled-post publisher, inbound email webhook, connected studio mailbox,
  replies routed back through the channel they arrived on

Built but unproven: the Meta adapter (needs App Review), the IMAP/SMTP path
(needs a real mailbox connected once).

Simulated: social linking and messages, ads, calendar, payments.

**Two things worth knowing before planning around them:**

1. `ANTHROPIC_API_KEY` is not set in production. Every AI feature currently
   self-disables. Workflows 3 and 5 assume AI; they are switched off today.
2. There is no test framework. For a platform being sold to a client and
   handling their client book, that is a delivery risk, not a nicety.

---

## Hard gates — start these on day one

None of these are engineering work, and all of them have lead times measured in
weeks. They should be running in the background from the start, not discovered
at the phase that needs them.

| Gate | Blocks | Lead time |
| --- | --- | --- |
| Meta App Review | Workflows 3–4, Instagram anything | Weeks, expect a rejection |
| WhatsApp Business API | Workflow 5 completion | Weeks |
| Stripe onboarding | Deposits, invoices | Days |
| Print-lab API access | Workflow 2 fulfilment | Unknown — most UK labs are portal-first |
| ICO registration | UK data controller obligation | Days |

The print-lab one is the highest-uncertainty item in the whole plan. Confirm a
lab has a usable ordering API **before** Phase 4 is scheduled, because if none
does, that phase becomes a semi-manual export flow and should be scoped as one.

---

## Phase 0 — Compliance and foundations

*Blocks everything. Small, and painful to retrofit.*

The proposal commits to UK GDPR alignment. The app does not implement it yet,
and every day of lead capture makes it more expensive to add.

- **Consent split.** The enquiry form's lawful basis covers *replying*. It does
  not cover marketing, which is what Phase 3's nurture sequences are. Separate
  opt-in checkbox, stored with timestamp and source.
- **Erasure path.** A "delete this client and everything about them" action —
  cascades already exist; the flow, confirmation, and audit record do not.
- **Data-subject access.** Export everything held about one client.
- **Audit trail.** Who did what, when. The proposal promises it and role-based
  access; today the only role distinction is owner vs staff on removal.
- **Test framework.** Vitest plus tests on the parts where a bug is silent:
  availability checks, message idempotency, encryption round-trip, RLS.
- Merge to `main`, apply outstanding migrations, set `ANTHROPIC_API_KEY`.

**Effort: small–medium.** Nothing here is glamorous and all of it is cheaper now
than later.

---

## Phase 1 — Client-facing gallery

*The biggest genuine gap, and the one with revenue attached.*

Everything after this depends on a client being able to see and choose images.
Albums, prints, AI content selection, and the gallery-ready touchpoint all
assume it exists.

- Share a shoot by tokenised link, optionally password-protected, with expiry
- Client favouriting, feeding `assets.is_select`
- An explicit approval step that locks the selection
- Download permissions per gallery — web-size vs full-resolution
- Watermarking on preview where the studio wants it
- View and download activity visible on the client record

Foundations exist: private bucket, signed URLs, ratings, selects. What is
missing is the entire client-facing surface, which is also the first thing a
Lensello client's own customers will ever see — it carries the brand.

**Effort: large.** The highest-value single phase.

---

## Phase 2 — Deposits and contracts

*Completes Workflow 1's booking half.*

- Stripe adapter replacing the simulated payment client
- Deposit and balance requests against a gig; `gigs` already has the columns
- Webhook for settlement, replacing the poll-count simulation
- Contract generation from a template, with the client accepting online
- Booking confirmed only when contract accepted **and** deposit cleared

On e-signature: a typed name plus timestamp, IP, and an immutable copy of what
was agreed is legally sufficient for most UK service contracts and is a
fraction of the work of integrating DocuSign. Worth a conversation rather than
an assumption.

**Effort: medium.** Gated on Stripe onboarding only.

---

## Phase 3 — Sequences and automated touchpoints

*Workflow 1's nurture half, plus Workflow 5's automation.*

- A sequence engine: trigger, ordered steps, delays, exit conditions
- Triggers from real events — enquiry received, quote sent, gig booked,
  gallery delivered, shoot completed
- Templates for booking confirmation, shoot reminder, gallery-ready, review
  request
- Suppression that actually works: consent withdrawn, client replied, stage
  changed, unsubscribed
- Twilio adapter if SMS is wanted
- Per-client sequence history on the timeline

Two prerequisites: Phase 0's consent record, and a cron that fires more than
once a day. **Vercel Hobby caps cron at daily**, which is unusable for
send-in-20-minutes steps — either Pro or an external trigger.

The hard part is not sending mail. It is never sending the wrong thing: no
nurture email to someone who already booked, no review request for a cancelled
shoot.

**Effort: large.**

---

## Phase 4 — Album builder and print fulfilment

*Workflow 2's second half.*

- Album layout generated from the approved selection, as a starting point to
  refine rather than a blank page
- Spread templates, reordering, captions
- Client review and approval of the album itself
- Print-lab ordering with specifications attached
- Order status tracked on the client record through to dispatch

**Do not schedule this until a lab's API is confirmed.** If UK labs turn out to
be portal-only, the honest version is a formatted export plus manual upload,
which is a different and much smaller piece of work — and should be sold as one.

**Effort: large, with high uncertainty on the fulfilment half.**

---

## Phase 5 — AI content studio

*Workflow 3, upgrading what campaigns already does.*

- Best-image shortlisting from a delivered gallery, starting from ratings and
  selects rather than pretending to have taste
- Blog post or case study drafted from the shoot
- Keyword and hashtag suggestions tuned to niche and location
- Alt text generation, which needs vision input and is a known gap
- Human approval before anything publishes — the proposal promises this and it
  is the right call

Depends on Phase 1 for the concept of a delivered gallery, and on
`ANTHROPIC_API_KEY` being set.

**Effort: medium.** Much of the scaffolding exists in `campaigns`.

---

## Phase 6 — Social engagement

*Workflow 4. Gated on Meta, not on us.*

- Real publishing and message collection once App Review passes
- Comment, DM, and mention detection
- Auto-replies to genuine FAQs, with a hard rule that anything about price,
  availability, or a specific date goes to a human
- Qualification flow creating a CRM lead when intent appears

The Meta adapter is already written and unverified. Budget time to fix it
against reality on first contact.

**Effort: medium after approval. Unschedulable before it.**

---

## Phase 7 — WhatsApp

*Workflow 5's last channel.* Same shape as Phase 6: gated on approval, adapter
work is modest once granted, and `messages.channel` already models it.

---

## Sequencing

```
Phase 0 ──┬─→ Phase 1 ──┬─→ Phase 4
          │             ├─→ Phase 5
          ├─→ Phase 2   │
          └─→ Phase 3 ──┘

Gates started at Phase 0 ──→ Phase 6, Phase 7 when approved
```

Phases 1, 2, and 3 are independent of each other once Phase 0 lands, so they
parallelise cleanly across agents in worktrees — the pattern the original five
modules were built with, against a frozen foundation.

---

## What I would deliberately not build

- **A second inbox.** Enquiries belong in the existing reply queue. A separate
  place to check is a place that goes unchecked.
- **Auto-replies that quote prices or confirm dates.** Availability changes and
  a wrong confirmation is a broken promise, not a support ticket.
- **An in-app image editor.** Photographers have Lightroom and will not switch.
- **Analytics dashboards before there is data.** Two months of real use will
  say more about what to measure than any guess made now.
