/**
 * Shared vocabulary for the automations module.
 *
 * The two lists below must stay byte-for-byte in sync with the `check`
 * constraints in `20260813120500_automations.sql`. They are not derived from
 * the database at build time — Supabase generated types give us the union of
 * legal strings (see `db.types.ts`), but not the plain-language labels a
 * photographer needs, which is what this file adds.
 */

import type { Tables } from '@/lib/db.types';

export type Automation = Tables<'automations'>;
export type AutomationStep = Tables<'automation_steps'>;
export type AutomationRun = Tables<'automation_runs'>;
export type AutomationRunStep = Tables<'automation_run_steps'>;
export type ApiKeyRow = Tables<'api_keys'>;

export type TriggerKind = Automation['trigger_kind'];
export type ActionKind = AutomationStep['action_kind'];
export type RunStatus = AutomationRun['status'];
export type RunStepStatus = AutomationRunStep['status'];

export const TRIGGER_KINDS: readonly TriggerKind[] = [
  'message_received',
  'inquiry_created',
  'client_stage_changed',
  'gig_booked',
  'gig_upcoming',
  'gallery_viewed',
  'gallery_approved',
  'order_paid',
  'campaign_task_due',
  'schedule',
  'webhook',
  'manual',
];

export const ACTION_KINDS: readonly ActionKind[] = [
  'send_email',
  'send_sms',
  'send_dm',
  'create_task',
  'create_client',
  'update_client_stage',
  'add_tag',
  'draft_reply',
  'notify_staff',
  'webhook',
  'wait',
  'branch',
];

/**
 * How a trigger actually starts a run.
 *
 *  - `event`: fired the moment something happens, from `dispatchAutomationEvent`.
 *    The write path that causes it lives in another module's route/action, which
 *    this agent may not edit — see the report for exact call sites still needing
 *    the one-line hook.
 *  - `polled`: nothing "happens" at a single instant to hook; a cron endpoint
 *    reconciles state (an approaching gig, a due task, a schedule) once a day.
 *  - `direct`: invoked on purpose, either by a person pressing "Run now" or by
 *    an authenticated `/api/v1` caller. Never matched against anything.
 */
export type TriggerMechanism = 'event' | 'polled' | 'direct';

export const TRIGGER_MECHANISM: Record<TriggerKind, TriggerMechanism> = {
  message_received: 'event',
  inquiry_created: 'event',
  client_stage_changed: 'event',
  gig_booked: 'event',
  gallery_viewed: 'event',
  gallery_approved: 'event',
  order_paid: 'event',
  gig_upcoming: 'polled',
  campaign_task_due: 'polled',
  schedule: 'polled',
  webhook: 'direct',
  manual: 'direct',
};

export const TRIGGER_LABELS: Record<TriggerKind, string> = {
  message_received: 'A client message arrives',
  inquiry_created: 'A new inquiry comes in',
  client_stage_changed: "A client's stage changes",
  gig_booked: 'A gig is confirmed',
  gig_upcoming: 'A gig is coming up',
  gallery_viewed: 'A client opens their gallery',
  gallery_approved: 'A client approves their selection',
  order_paid: 'A print order is paid',
  campaign_task_due: 'A campaign task is due',
  schedule: 'On a schedule',
  webhook: 'An external system calls in',
  manual: 'Run by hand or by API',
};

export const TRIGGER_DESCRIPTIONS: Record<TriggerKind, string> = {
  message_received: 'Starts when a client writes in on any connected channel.',
  inquiry_created: 'Starts when the public inquiry form is submitted.',
  client_stage_changed: "Starts when a client's pipeline stage changes, e.g. moves to Booked.",
  gig_booked: 'Starts when a gig is confirmed on the calendar.',
  gig_upcoming: 'Starts a set number of days before a confirmed gig. Checked once a day, not to the minute.',
  gallery_viewed: 'Starts the first time a client opens their gallery link.',
  gallery_approved: 'Starts when a client approves their final selection.',
  order_paid: 'Starts when a print order is paid for.',
  campaign_task_due: 'Starts when a campaign task becomes due. Checked once a day.',
  schedule: 'Starts on a recurring schedule. Checked once a day, so this is a daily job, not a minute-accurate timer — the Vercel plan this runs on allows cron once per day.',
  webhook: 'Starts when a system holding an API key calls this automation directly.',
  manual: 'Starts only when someone presses "Run now", or an API key triggers it.',
};

export const ACTION_LABELS: Record<ActionKind, string> = {
  send_email: 'Send an email',
  send_sms: 'Send a text message',
  send_dm: 'Send a direct message',
  create_task: 'Create a task',
  create_client: 'Create a client record',
  update_client_stage: "Change the client's stage",
  add_tag: 'Add a tag to the client',
  draft_reply: 'Draft a reply for staff to send',
  notify_staff: 'Notify the studio',
  webhook: 'Call an external URL',
  wait: 'Wait briefly',
  branch: 'Only continue if…',
};

export const ACTION_DESCRIPTIONS: Record<ActionKind, string> = {
  send_email: "Sends an email to the client through the studio's connected mailbox.",
  send_sms: 'Not available yet — there is no SMS provider connected. This step fails rather than pretending to send.',
  send_dm: "Sends a direct message on the platform the client wrote in on, if their account is linked.",
  create_task: 'Adds a checklist task to the gig or campaign this automation is about.',
  create_client: 'Creates a client record if one does not already exist for this email address.',
  update_client_stage: 'Moves the client to a different stage in the pipeline.',
  add_tag: 'Not available yet — clients have no tagging field in the schema. This step fails rather than silently doing nothing.',
  draft_reply: 'Emails the studio a suggested reply to send by hand, rather than sending anything to the client directly.',
  notify_staff: 'Sends an internal email to the studio owner(s), never to the client.',
  webhook: 'Sends the trigger details as JSON to a URL you choose — for a spreadsheet, Zapier, or another tool.',
  wait: 'Pauses briefly before the next step. Long waits fail with an explanation rather than silently hanging — there is no job queue behind this.',
  branch: 'Checks a condition and skips a chosen number of following steps when it is not met.',
};

/** Which trigger kinds `dispatchAutomationEvent` can match against. */
export const DISPATCHABLE_TRIGGERS: readonly TriggerKind[] = TRIGGER_KINDS.filter(
  (kind) => TRIGGER_MECHANISM[kind] === 'event',
);

/** Which trigger kinds the cron reconciler is responsible for. */
export const POLLED_TRIGGERS: readonly TriggerKind[] = TRIGGER_KINDS.filter(
  (kind) => TRIGGER_MECHANISM[kind] === 'polled',
);

/** A run cannot chain into itself, or into a cycle, forever. */
export const MAX_CHAIN_DEPTH = 5;

/** Reasons a run can be skipped, matched 1:1 with `automation_runs.skip_reason`. */
export type SkipReason =
  | 'disabled'
  | 'loop_detected'
  | 'chain_too_deep'
  | 'rate_limited'
  | 'filter_not_matched';

export const SKIP_REASON_LABELS: Record<SkipReason, string> = {
  disabled: 'The automation is switched off.',
  loop_detected: 'This automation would have triggered itself — stopped to prevent a runaway loop.',
  chain_too_deep: 'Too many automations chained together in one event — stopped as a precaution.',
  rate_limited: 'The daily run limit for this automation was already reached.',
  filter_not_matched: 'The event happened, but did not match this automation’s filter.',
};

/**
 * The generic shape every step sees at run time, built once per run by
 * `buildRunContext` and reused for every step. Individual steps narrow what
 * they read from it — a `send_email` step needs `client`, a `webhook` step
 * mostly wants `trigger`.
 */
export interface RunContext {
  automation: Pick<Automation, 'id' | 'name'>;
  trigger: { kind: TriggerKind; payload: Record<string, unknown> };
  client: Tables<'clients'> | null;
  gig: Tables<'gigs'> | null;
  gallery: Tables<'galleries'> | null;
}
