/**
 * Validation for everything the builder UI submits.
 *
 * Two layers: the automation/step envelope (name, trigger kind, ordering) and
 * the per-kind `config` blob, which is `jsonb` in the database and therefore
 * whatever shape each trigger/action kind wants. Both must pass before
 * anything is written — the builder is the only path from a browser to these
 * tables, but Server Actions are reachable by direct POST, so the schema is
 * the actual guard, not the form.
 */

import { z } from 'zod';
import { ACTION_KINDS, TRIGGER_KINDS, type ActionKind, type TriggerKind } from './types';

export function firstIssue(error: z.ZodError, fallback = 'Check the form and try again.'): string {
  return error.issues[0]?.message ?? fallback;
}

export const uuidSchema = z.uuid('That is not a valid id.');

// --- automation envelope --------------------------------------------------

export const triggerKindSchema = z.enum(TRIGGER_KINDS as [TriggerKind, ...TriggerKind[]]);
export const actionKindSchema = z.enum(ACTION_KINDS as [ActionKind, ...ActionKind[]]);

export const createAutomationSchema = z.object({
  name: z.string().trim().min(1, 'Give it a name.').max(120),
  description: z.string().trim().max(500).optional(),
  triggerKind: triggerKindSchema,
});

export const updateAutomationSchema = z.object({
  automationId: uuidSchema,
  name: z.string().trim().min(1, 'Give it a name.').max(120),
  description: z.string().trim().max(500).optional(),
  maxRunsPerDay: z
    .union([z.literal(''), z.coerce.number().int().min(1).max(1000)])
    .transform((value) => (value === '' ? null : value))
    .optional(),
});

export const setEnabledSchema = z.object({
  automationId: uuidSchema,
  enabled: z.enum(['true', 'false']).transform((value) => value === 'true'),
});

export const deleteAutomationSchema = z.object({ automationId: uuidSchema });

// --- trigger config, by kind ----------------------------------------------

/** Only the two kinds the migration comment calls out get a real filter. */
export const messageReceivedConfigSchema = z.object({
  channel: z
    .enum(['any', 'email', 'form', 'instagram', 'facebook', 'tiktok', 'pinterest', 'sms', 'whatsapp', 'comment'])
    .default('any'),
});

export const clientStageChangedConfigSchema = z.object({
  toStage: z.enum(['any', 'lead', 'inquiry', 'quoted', 'booked', 'completed', 'lost']).default('any'),
});

export const gigUpcomingConfigSchema = z.object({
  daysBefore: z.coerce.number().int().min(0).max(60).default(3),
});

export const gigBookedConfigSchema = z.object({
  gigType: z
    .enum(['any', 'wedding', 'engagement', 'portrait', 'headshot', 'family', 'event', 'commercial', 'product', 'real_estate'])
    .default('any'),
});

export const galleryViewedConfigSchema = z.object({
  /** Fire once per gallery, not once per refresh. Off by choice = every view. */
  onlyFirstView: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .default(true)
    .transform((value) => value === true || value === 'true'),
});

export const campaignTaskDueConfigSchema = z.object({
  taskKind: z.string().trim().max(60).optional(),
});

export const scheduleConfigSchema = z.object({
  /**
   * Days to run on, 0 = Sunday .. 6 = Saturday, UTC. Empty means every day.
   * There is deliberately no time-of-day field: the cron that reconciles this
   * runs once a day, so a stored time could never be honoured and showing one
   * would be a promise the platform breaks.
   */
  daysOfWeek: z.array(z.number().int().min(0).max(6)).default([]),
});

/** Kinds with no meaningful filter: inquiry_created, gallery_approved, order_paid, webhook, manual. */
export const emptyConfigSchema = z.object({}).strict();

export const TRIGGER_CONFIG_SCHEMAS: Record<TriggerKind, z.ZodType> = {
  message_received: messageReceivedConfigSchema,
  inquiry_created: emptyConfigSchema,
  client_stage_changed: clientStageChangedConfigSchema,
  gig_booked: gigBookedConfigSchema,
  gig_upcoming: gigUpcomingConfigSchema,
  gallery_viewed: galleryViewedConfigSchema,
  gallery_approved: emptyConfigSchema,
  order_paid: emptyConfigSchema,
  campaign_task_due: campaignTaskDueConfigSchema,
  schedule: scheduleConfigSchema,
  webhook: emptyConfigSchema,
  manual: emptyConfigSchema,
};

// --- step config, by action kind ------------------------------------------

export const sendEmailConfigSchema = z.object({
  subject: z.string().trim().min(1, 'Give the email a subject.').max(200),
  body: z.string().trim().min(1, 'Write the email body.').max(5000),
  /** Marketing mail is blocked for a client without consent; transactional never checks. */
  category: z.enum(['transactional', 'marketing']).default('transactional'),
});

export const sendSmsConfigSchema = z.object({
  body: z.string().trim().min(1).max(1000),
});

export const sendDmConfigSchema = z.object({
  body: z.string().trim().min(1, 'Write the message.').max(1000),
});

export const createTaskConfigSchema = z.object({
  target: z.enum(['gig', 'campaign']).default('gig'),
  label: z.string().trim().min(1, 'Give the task a label.').max(200),
  campaignId: z.uuid().optional(),
  dueInDays: z.coerce.number().int().min(0).max(365).optional(),
});

export const createClientConfigSchema = z.object({
  nameTemplate: z.string().trim().min(1).max(200).default('{{trigger.name}}'),
  emailTemplate: z.string().trim().min(1).max(200).default('{{trigger.email}}'),
  stage: z.enum(['lead', 'inquiry', 'quoted', 'booked', 'completed', 'lost']).default('lead'),
});

export const updateClientStageConfigSchema = z.object({
  toStage: z.enum(['lead', 'inquiry', 'quoted', 'booked', 'completed', 'lost']),
});

export const addTagConfigSchema = z.object({
  tag: z.string().trim().min(1).max(60),
});

export const draftReplyConfigSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
});

export const notifyStaffConfigSchema = z.object({
  subject: z.string().trim().min(1, 'Give it a subject.').max(200),
  body: z.string().trim().min(1, 'Write the message.').max(5000),
});

export const webhookConfigSchema = z.object({
  url: z.url('Enter a valid https:// URL.').refine((value) => value.startsWith('https://') || value.startsWith('http://'), {
    message: 'The URL must start with http:// or https://.',
  }),
  method: z.enum(['POST', 'GET']).default('POST'),
});

export const waitConfigSchema = z.object({
  seconds: z.coerce.number().int().min(1).max(30),
});

export const branchConfigSchema = z.object({
  field: z.string().trim().min(1, 'Name the field to check, e.g. client.stage.').max(100),
  operator: z.enum(['equals', 'not_equals', 'contains', 'exists', 'not_exists']).default('equals'),
  value: z.string().trim().max(200).optional(),
  skipCount: z.coerce.number().int().min(1).max(20).default(1),
});

export const ACTION_CONFIG_SCHEMAS: Record<ActionKind, z.ZodType> = {
  send_email: sendEmailConfigSchema,
  send_sms: sendSmsConfigSchema,
  send_dm: sendDmConfigSchema,
  create_task: createTaskConfigSchema,
  create_client: createClientConfigSchema,
  update_client_stage: updateClientStageConfigSchema,
  add_tag: addTagConfigSchema,
  draft_reply: draftReplyConfigSchema,
  notify_staff: notifyStaffConfigSchema,
  webhook: webhookConfigSchema,
  wait: waitConfigSchema,
  branch: branchConfigSchema,
};

export const addStepSchema = z.object({
  automationId: uuidSchema,
  actionKind: actionKindSchema,
  continueOnError: z.enum(['true', 'false']).transform((value) => value === 'true').default(false),
});

export const removeStepSchema = z.object({
  automationId: uuidSchema,
  stepId: uuidSchema,
});

export const moveStepSchema = z.object({
  automationId: uuidSchema,
  stepId: uuidSchema,
  direction: z.enum(['up', 'down']),
});

// --- API keys --------------------------------------------------------------

export const API_KEY_SCOPE_VALUES = ['automations:read', 'automations:trigger'] as const;

export const createApiKeySchema = z.object({
  name: z.string().trim().min(1, 'Name the key so you can tell it apart later.').max(120),
  scopes: z.array(z.enum(API_KEY_SCOPE_VALUES)).default([]),
});

export const revokeApiKeySchema = z.object({ keyId: uuidSchema });

export const manualRunSchema = z.object({
  automationId: uuidSchema,
  clientId: z.union([z.literal(''), uuidSchema]).optional(),
  confirm: z.string(),
});
