/**
 * Turns a submitted `FormData` into the raw object each config schema
 * expects, for whichever trigger/action kind the form was rendered for.
 *
 * One function per kind rather than a generic "collect every field" reader:
 * a stray field from a browser extension or a mis-copied form should not
 * silently become part of a stored config, and `zod`'s `.strict()` schemas
 * would reject it anyway — better to only ever hand them the fields they
 * define.
 */

import type { ActionKind, TriggerKind } from './types';

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function checkbox(formData: FormData, key: string): boolean {
  return formData.get(key) === 'on' || formData.get(key) === 'true';
}

function numberList(formData: FormData, key: string): number[] {
  return formData
    .getAll(key)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value));
}

export function readTriggerConfigForm(kind: TriggerKind, formData: FormData): Record<string, unknown> {
  switch (kind) {
    case 'message_received':
      return { channel: str(formData, 'channel') || 'any' };
    case 'client_stage_changed':
      return { toStage: str(formData, 'toStage') || 'any' };
    case 'gig_booked':
      return { gigType: str(formData, 'gigType') || 'any' };
    case 'gig_upcoming':
      return { daysBefore: str(formData, 'daysBefore') || '3' };
    case 'gallery_viewed':
      return { onlyFirstView: checkbox(formData, 'onlyFirstView') };
    case 'campaign_task_due':
      return { taskKind: str(formData, 'taskKind') || undefined };
    case 'schedule':
      return { daysOfWeek: numberList(formData, 'daysOfWeek') };
    default:
      return {};
  }
}

export function readActionConfigForm(kind: ActionKind, formData: FormData): Record<string, unknown> {
  switch (kind) {
    case 'send_email':
      return {
        subject: str(formData, 'subject'),
        body: str(formData, 'body'),
        category: str(formData, 'category') || 'transactional',
      };
    case 'send_sms':
      return { body: str(formData, 'body') };
    case 'send_dm':
      return { body: str(formData, 'body') };
    case 'create_task':
      return {
        target: str(formData, 'target') || 'gig',
        label: str(formData, 'label'),
        campaignId: str(formData, 'campaignId') || undefined,
        dueInDays: str(formData, 'dueInDays') || undefined,
      };
    case 'create_client':
      return {
        nameTemplate: str(formData, 'nameTemplate') || '{{trigger.name}}',
        emailTemplate: str(formData, 'emailTemplate') || '{{trigger.email}}',
        stage: str(formData, 'stage') || 'lead',
      };
    case 'update_client_stage':
      return { toStage: str(formData, 'toStage') };
    case 'add_tag':
      return { tag: str(formData, 'tag') };
    case 'draft_reply':
      return { subject: str(formData, 'subject'), body: str(formData, 'body') };
    case 'notify_staff':
      return { subject: str(formData, 'subject'), body: str(formData, 'body') };
    case 'webhook':
      return { url: str(formData, 'url'), method: str(formData, 'method') || 'POST' };
    case 'wait':
      return { seconds: str(formData, 'seconds') || '5' };
    case 'branch':
      return {
        field: str(formData, 'field'),
        operator: str(formData, 'operator') || 'equals',
        value: str(formData, 'value') || undefined,
        skipCount: str(formData, 'skipCount') || '1',
      };
    default:
      return {};
  }
}
