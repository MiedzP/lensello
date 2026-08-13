/**
 * Plain-language rendering for the builder — the "what will this actually do"
 * summary the brief asks for. None of this executes anything; it only
 * describes the stored config back to a photographer in a sentence they did
 * not have to learn JSON to read.
 */

import type { Tone } from '@/components/ui';
import {
  ACTION_DESCRIPTIONS,
  ACTION_LABELS,
  TRIGGER_DESCRIPTIONS,
  TRIGGER_LABELS,
  type ActionKind,
  type Automation,
  type AutomationStep,
  type RunStatus,
  type RunStepStatus,
  type TriggerKind,
} from './types';

export function runStatusTone(status: RunStatus | RunStepStatus): Tone {
  switch (status) {
    case 'succeeded':
      return 'success';
    case 'failed':
      return 'danger';
    case 'skipped':
      return 'warning';
    case 'cancelled':
      return 'neutral';
    case 'running':
    default:
      return 'accent';
  }
}

/** One sentence describing what starts this automation, including its filter. */
export function describeTrigger(automation: Pick<Automation, 'trigger_kind' | 'trigger_config'>): string {
  const kind = automation.trigger_kind as TriggerKind;
  const base = TRIGGER_LABELS[kind];
  const config = (automation.trigger_config ?? {}) as Record<string, unknown>;

  switch (kind) {
    case 'message_received':
      if (config.channel && config.channel !== 'any') return `${base} on ${config.channel}`;
      return base;
    case 'client_stage_changed':
      if (config.toStage && config.toStage !== 'any') return `A client's stage changes to "${config.toStage}"`;
      return base;
    case 'gig_booked':
      if (config.gigType && config.gigType !== 'any') return `A ${config.gigType} gig is confirmed`;
      return base;
    case 'gig_upcoming': {
      const days = typeof config.daysBefore === 'number' ? config.daysBefore : 3;
      return `${days} day${days === 1 ? '' : 's'} before a confirmed gig`;
    }
    case 'gallery_viewed':
      return config.onlyFirstView === false ? 'Every time a client opens their gallery' : base;
    case 'schedule': {
      const days = Array.isArray(config.daysOfWeek) ? (config.daysOfWeek as number[]) : [];
      if (days.length === 0) return 'Once a day';
      const names = days.map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ');
      return `Once a day, on: ${names}`;
    }
    default:
      return base;
  }
}

export function triggerHelp(kind: TriggerKind): string {
  return TRIGGER_DESCRIPTIONS[kind];
}

/** One sentence per step, in order, for the step list and the preview panel. */
export function describeStep(step: Pick<AutomationStep, 'action_kind' | 'config' | 'continue_on_error'>): string {
  const kind = step.action_kind as ActionKind;
  const config = (step.config ?? {}) as Record<string, unknown>;
  const suffix = step.continue_on_error ? ' (continues even if this fails)' : '';

  switch (kind) {
    case 'send_email':
      return `Email the client: "${String(config.subject ?? '(no subject)')}"${
        config.category === 'marketing' ? ' — marketing, requires consent' : ''
      }${suffix}`;
    case 'send_dm':
      return `Direct-message the client${suffix}`;
    case 'send_sms':
      return `Text the client — unavailable, will fail${suffix}`;
    case 'create_task':
      return `Add "${String(config.label ?? 'a task')}" to the ${config.target === 'campaign' ? 'campaign' : 'gig'} checklist${suffix}`;
    case 'create_client':
      return `Create a client record if one doesn't exist${suffix}`;
    case 'update_client_stage':
      return `Move the client to "${String(config.toStage ?? '?')}"${suffix}`;
    case 'add_tag':
      return `Tag the client — unavailable, will fail${suffix}`;
    case 'draft_reply':
      return `Email the studio a drafted reply to send by hand${suffix}`;
    case 'notify_staff':
      return `Notify the studio: "${String(config.subject ?? '(no subject)')}"${suffix}`;
    case 'webhook':
      return `Call ${String(config.url ?? 'a URL')}${suffix}`;
    case 'wait':
      return `Wait ${String(config.seconds ?? '?')} seconds${suffix}`;
    case 'branch':
      return `Only continue if ${String(config.field ?? '?')} ${String(config.operator ?? 'equals')} ${String(config.value ?? '')}, else skip the next ${String(config.skipCount ?? 1)} step(s)`;
    default:
      return ACTION_LABELS[kind];
  }
}

export function actionHelp(kind: ActionKind): string {
  return ACTION_DESCRIPTIONS[kind];
}

/**
 * The full "what will this actually do" paragraph: trigger, filter, and every
 * step in order. Pure text — safe to render before the automation is even
 * saved, and exactly what a "Run now" confirmation should show right above
 * the button that sends something real.
 */
export function buildPreview(
  automation: Pick<Automation, 'trigger_kind' | 'trigger_config' | 'enabled' | 'max_runs_per_day'>,
  steps: Array<Pick<AutomationStep, 'action_kind' | 'config' | 'continue_on_error'>>,
): string[] {
  const lines: string[] = [];

  lines.push(`Trigger: ${describeTrigger(automation)}.`);
  lines.push(
    automation.enabled
      ? 'This automation is ON — it will run for real.'
      : 'This automation is OFF — nothing below will run until it is switched on.',
  );
  if (automation.max_runs_per_day) {
    lines.push(`Limited to ${automation.max_runs_per_day} run(s) per day.`);
  } else {
    lines.push('No daily run limit is set — consider adding one.');
  }

  if (steps.length === 0) {
    lines.push('No steps yet — this automation does nothing.');
  } else {
    steps.forEach((step, index) => lines.push(`${index + 1}. ${describeStep(step)}`));
  }

  return lines;
}
