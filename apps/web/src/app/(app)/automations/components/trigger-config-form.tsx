'use client';

import { Button, Card, CardBody, CardFooter, CardHeader, Field, Input, Select } from '@/components/ui';
import { TRIGGER_DESCRIPTIONS, TRIGGER_LABELS, type Automation } from '@/lib/automations/types';
import { updateTriggerConfigAction } from '../actions';

const CLIENT_STAGES = ['any', 'lead', 'inquiry', 'quoted', 'booked', 'completed', 'lost'];
const GIG_TYPES = ['any', 'wedding', 'engagement', 'portrait', 'headshot', 'family', 'event', 'commercial', 'product', 'real_estate'];
const CHANNELS = ['any', 'email', 'form', 'instagram', 'facebook', 'tiktok', 'pinterest', 'sms', 'whatsapp', 'comment'];
const WEEKDAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

/** Fields specific to each trigger kind. Everything else has no filter to show. */
function KindFields({ automation }: { automation: Automation }) {
  const config = (automation.trigger_config ?? {}) as Record<string, unknown>;

  switch (automation.trigger_kind) {
    case 'message_received':
      return (
        <Field label="Only on this channel" htmlFor="channel">
          <Select id="channel" name="channel" defaultValue={String(config.channel ?? 'any')}>
            {CHANNELS.map((channel) => (
              <option key={channel} value={channel}>
                {channel === 'any' ? 'Any channel' : channel}
              </option>
            ))}
          </Select>
        </Field>
      );
    case 'client_stage_changed':
      return (
        <Field label="Only when the new stage is" htmlFor="toStage">
          <Select id="toStage" name="toStage" defaultValue={String(config.toStage ?? 'any')}>
            {CLIENT_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stage === 'any' ? 'Any stage' : stage}
              </option>
            ))}
          </Select>
        </Field>
      );
    case 'gig_booked':
      return (
        <Field label="Only for this gig type" htmlFor="gigType">
          <Select id="gigType" name="gigType" defaultValue={String(config.gigType ?? 'any')}>
            {GIG_TYPES.map((type) => (
              <option key={type} value={type}>
                {type === 'any' ? 'Any type' : type}
              </option>
            ))}
          </Select>
        </Field>
      );
    case 'gig_upcoming':
      return (
        <Field label="Days before the gig" htmlFor="daysBefore" hint="Checked once a day, so this is a day, not a moment.">
          <Input
            id="daysBefore"
            name="daysBefore"
            type="number"
            min={0}
            max={60}
            defaultValue={String(config.daysBefore ?? 3)}
          />
        </Field>
      );
    case 'gallery_viewed':
      return (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="onlyFirstView"
            defaultChecked={config.onlyFirstView !== false}
            className="size-4 accent-accent"
          />
          Only the first time each client opens their gallery
        </label>
      );
    case 'campaign_task_due':
      return (
        <Field label="Only this task kind" htmlFor="taskKind" hint="Leave blank for any kind.">
          <Input id="taskKind" name="taskKind" defaultValue={String(config.taskKind ?? '')} maxLength={60} />
        </Field>
      );
    case 'schedule': {
      const days = Array.isArray(config.daysOfWeek) ? (config.daysOfWeek as number[]) : [];
      return (
        <fieldset>
          <legend className="text-sm font-medium text-foreground">Days to run</legend>
          <p className="mt-1 text-xs text-muted">
            Leave all unchecked to run every day. Checked once a day — not a minute-accurate timer.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => (
              <label
                key={day.value}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-strong bg-surface px-2.5 py-1.5 text-xs text-foreground hover:bg-surface-hover"
              >
                <input
                  type="checkbox"
                  name="daysOfWeek"
                  value={day.value}
                  defaultChecked={days.includes(day.value)}
                  className="size-3.5 accent-accent"
                />
                {day.label}
              </label>
            ))}
          </div>
        </fieldset>
      );
    }
    default:
      return <p className="text-sm text-muted">{TRIGGER_DESCRIPTIONS[automation.trigger_kind]}</p>;
  }
}

export function TriggerConfigForm({ automation }: { automation: Automation }) {
  return (
    <Card>
      <CardHeader title={TRIGGER_LABELS[automation.trigger_kind]} description={TRIGGER_DESCRIPTIONS[automation.trigger_kind]} />
      <form action={updateTriggerConfigAction}>
        <input type="hidden" name="automationId" value={automation.id} />
        <input type="hidden" name="triggerKind" value={automation.trigger_kind} />
        <CardBody className="space-y-4">
          <KindFields automation={automation} />
        </CardBody>
        <CardFooter>
          <Button type="submit" variant="primary" size="sm">
            Save trigger
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
