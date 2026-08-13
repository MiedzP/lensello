'use client';

import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Field,
  Input,
  Select,
  Textarea,
} from '@/components/ui';
import { ACTION_DESCRIPTIONS, ACTION_LABELS, type AutomationStep } from '@/lib/automations/types';
import { moveStepAction, removeStepAction, updateStepConfigAction } from '../actions';

const CLIENT_STAGES = ['lead', 'inquiry', 'quoted', 'booked', 'completed', 'lost'];

function KindFields({ step }: { step: AutomationStep }) {
  const config = (step.config ?? {}) as Record<string, unknown>;
  const id = step.id;

  switch (step.action_kind) {
    case 'send_email':
      return (
        <>
          <Field label="Category" htmlFor={`category-${id}`} hint="Marketing mail checks the client's consent first; transactional never does.">
            <Select id={`category-${id}`} name="category" defaultValue={String(config.category ?? 'transactional')}>
              <option value="transactional">Transactional (booking, gallery, order)</option>
              <option value="marketing">Marketing (requires consent)</option>
            </Select>
          </Field>
          <Field label="Subject" htmlFor={`subject-${id}`} required>
            <Input id={`subject-${id}`} name="subject" maxLength={200} defaultValue={String(config.subject ?? '')} required />
          </Field>
          <Field label="Body" htmlFor={`body-${id}`} required hint="Use {{client.name}}, {{gig.title}}, {{gallery.title}}.">
            <Textarea id={`body-${id}`} name="body" rows={5} maxLength={5000} defaultValue={String(config.body ?? '')} required />
          </Field>
        </>
      );
    case 'send_sms':
    case 'send_dm':
      return (
        <Field label="Message" htmlFor={`body-${id}`} required>
          <Textarea id={`body-${id}`} name="body" rows={3} maxLength={1000} defaultValue={String(config.body ?? '')} required />
        </Field>
      );
    case 'create_task':
      return (
        <>
          <Field label="Add to" htmlFor={`target-${id}`}>
            <Select id={`target-${id}`} name="target" defaultValue={String(config.target ?? 'gig')}>
              <option value="gig">The gig this trigger is about</option>
              <option value="campaign">A specific campaign</option>
            </Select>
          </Field>
          <Field label="Campaign id" htmlFor={`campaignId-${id}`} hint="Only used when targeting a campaign.">
            <Input id={`campaignId-${id}`} name="campaignId" defaultValue={String(config.campaignId ?? '')} />
          </Field>
          <Field label="Task label" htmlFor={`label-${id}`} required>
            <Input id={`label-${id}`} name="label" maxLength={200} defaultValue={String(config.label ?? '')} required />
          </Field>
          <Field label="Due in (days)" htmlFor={`dueInDays-${id}`}>
            <Input id={`dueInDays-${id}`} name="dueInDays" type="number" min={0} defaultValue={String(config.dueInDays ?? '')} />
          </Field>
        </>
      );
    case 'create_client':
      return (
        <>
          <Field label="Name template" htmlFor={`nameTemplate-${id}`} hint="e.g. {{trigger.name}}">
            <Input id={`nameTemplate-${id}`} name="nameTemplate" defaultValue={String(config.nameTemplate ?? '{{trigger.name}}')} />
          </Field>
          <Field label="Email template" htmlFor={`emailTemplate-${id}`} hint="e.g. {{trigger.email}}">
            <Input id={`emailTemplate-${id}`} name="emailTemplate" defaultValue={String(config.emailTemplate ?? '{{trigger.email}}')} />
          </Field>
          <Field label="Starting stage" htmlFor={`stage-${id}`}>
            <Select id={`stage-${id}`} name="stage" defaultValue={String(config.stage ?? 'lead')}>
              {CLIENT_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </Select>
          </Field>
        </>
      );
    case 'update_client_stage':
      return (
        <Field label="New stage" htmlFor={`toStage-${id}`} required>
          <Select id={`toStage-${id}`} name="toStage" defaultValue={String(config.toStage ?? 'booked')}>
            {CLIENT_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </Select>
        </Field>
      );
    case 'add_tag':
      return (
        <Field label="Tag" htmlFor={`tag-${id}`} hint="Saved, but this step fails when it runs — see the description above.">
          <Input id={`tag-${id}`} name="tag" maxLength={60} defaultValue={String(config.tag ?? '')} />
        </Field>
      );
    case 'draft_reply':
    case 'notify_staff':
      return (
        <>
          <Field label="Subject" htmlFor={`subject-${id}`} required>
            <Input id={`subject-${id}`} name="subject" maxLength={200} defaultValue={String(config.subject ?? '')} required />
          </Field>
          <Field label="Body" htmlFor={`body-${id}`} required>
            <Textarea id={`body-${id}`} name="body" rows={4} maxLength={5000} defaultValue={String(config.body ?? '')} required />
          </Field>
        </>
      );
    case 'webhook':
      return (
        <>
          <Field label="URL" htmlFor={`url-${id}`} required>
            <Input id={`url-${id}`} name="url" type="url" defaultValue={String(config.url ?? '')} required placeholder="https://…" />
          </Field>
          <Field label="Method" htmlFor={`method-${id}`}>
            <Select id={`method-${id}`} name="method" defaultValue={String(config.method ?? 'POST')}>
              <option value="POST">POST (with a JSON body)</option>
              <option value="GET">GET</option>
            </Select>
          </Field>
        </>
      );
    case 'wait':
      return (
        <Field label="Seconds" htmlFor={`seconds-${id}`} hint="Capped at 30 — see the description above for why.">
          <Input id={`seconds-${id}`} name="seconds" type="number" min={1} max={30} defaultValue={String(config.seconds ?? 5)} />
        </Field>
      );
    case 'branch':
      return (
        <>
          <Field label="Field to check" htmlFor={`field-${id}`} required hint="e.g. client.stage, client.marketing_consent, gig.type">
            <Input id={`field-${id}`} name="field" defaultValue={String(config.field ?? '')} required />
          </Field>
          <Field label="Operator" htmlFor={`operator-${id}`}>
            <Select id={`operator-${id}`} name="operator" defaultValue={String(config.operator ?? 'equals')}>
              <option value="equals">equals</option>
              <option value="not_equals">does not equal</option>
              <option value="contains">contains</option>
              <option value="exists">exists</option>
              <option value="not_exists">does not exist</option>
            </Select>
          </Field>
          <Field label="Value" htmlFor={`value-${id}`} hint="Not used for exists / does not exist.">
            <Input id={`value-${id}`} name="value" defaultValue={String(config.value ?? '')} />
          </Field>
          <Field label="Steps to skip if not met" htmlFor={`skipCount-${id}`}>
            <Input id={`skipCount-${id}`} name="skipCount" type="number" min={1} max={20} defaultValue={String(config.skipCount ?? 1)} />
          </Field>
        </>
      );
    default:
      return null;
  }
}

export function StepEditor({
  step,
  index,
  isFirst,
  isLast,
  automationId,
}: {
  step: AutomationStep;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  automationId: string;
}) {
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Badge tone="accent">{index + 1}</Badge>
            {ACTION_LABELS[step.action_kind]}
          </span>
        }
        description={ACTION_DESCRIPTIONS[step.action_kind]}
        action={
          <div className="flex items-center gap-1">
            <form action={moveStepAction}>
              <input type="hidden" name="automationId" value={automationId} />
              <input type="hidden" name="stepId" value={step.id} />
              <input type="hidden" name="direction" value="up" />
              <Button type="submit" variant="ghost" size="sm" disabled={isFirst} aria-label="Move up">
                <ArrowUp size={14} aria-hidden="true" />
              </Button>
            </form>
            <form action={moveStepAction}>
              <input type="hidden" name="automationId" value={automationId} />
              <input type="hidden" name="stepId" value={step.id} />
              <input type="hidden" name="direction" value="down" />
              <Button type="submit" variant="ghost" size="sm" disabled={isLast} aria-label="Move down">
                <ArrowDown size={14} aria-hidden="true" />
              </Button>
            </form>
            <form action={removeStepAction}>
              <input type="hidden" name="automationId" value={automationId} />
              <input type="hidden" name="stepId" value={step.id} />
              <Button type="submit" variant="ghost" size="sm" aria-label="Remove step">
                <Trash2 size={14} aria-hidden="true" className="text-danger" />
              </Button>
            </form>
          </div>
        }
      />
      <form action={updateStepConfigAction}>
        <input type="hidden" name="automationId" value={automationId} />
        <input type="hidden" name="stepId" value={step.id} />
        <input type="hidden" name="actionKind" value={step.action_kind} />
        <CardBody className="space-y-4">
          <KindFields step={step} />
        </CardBody>
        <CardFooter className="justify-between">
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              name="continueOnError"
              defaultChecked={step.continue_on_error}
              className="size-3.5 accent-accent"
            />
            Keep going even if this step fails
          </label>
          <Button type="submit" variant="secondary" size="sm">
            Save step
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
