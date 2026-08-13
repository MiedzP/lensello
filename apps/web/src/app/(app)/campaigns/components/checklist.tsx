'use client';

import { useState, useTransition } from 'react';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  Select,
  Textarea,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { IDLE } from '@/lib/campaigns/action-state';
import { formatDateOnly } from '@/lib/campaigns/display';
import { TASK_KINDS, type CampaignTaskRow, type TaskKind } from '@/lib/planner/types';
import {
  TASK_KIND_LABELS,
  TASK_KIND_TONES,
  TASK_STATUS_LABELS,
  TASK_STATUS_TONES,
  taskStatus,
} from '@/lib/planner/display';
import type { ClientRef, StaffRef } from '@/lib/planner/queries';
import {
  addCampaignTask,
  deleteCampaignTask,
  toggleCampaignTask,
  updateCampaignTask,
} from '../planner-actions';

export interface ChecklistPostRef {
  id: string;
  platform: string;
  caption: string;
}

interface ChecklistProps {
  campaignId: string;
  tasks: CampaignTaskRow[];
  clients: ClientRef[];
  staff: StaffRef[];
  posts: ChecklistPostRef[];
  todayIso: string;
}

function buildFormData(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

export function Checklist({ campaignId, tasks, clients, staff, posts, todayIso }: ChecklistProps) {
  const [adding, setAdding] = useState(false);
  const clientsById = new Map(clients.map((c) => [c.id, c.name]));
  const staffById = new Map(staff.map((s) => [s.id, s.full_name]));
  const postsById = new Map(posts.map((p) => [p.id, p]));

  const open = tasks.filter((task) => !task.done_at);
  const done = tasks.filter((task) => task.done_at);

  return (
    <Card>
      <CardHeader
        title="Checklist"
        description="Dated tasks — from a plan, or added by hand. Tick them off as the campaign runs."
        action={
          <Button size="sm" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
            <Plus size={14} aria-hidden="true" />
            Add task
          </Button>
        }
      />
      <CardBody className="space-y-4">
        {adding ? (
          <TaskForm
            campaignId={campaignId}
            clients={clients}
            staff={staff}
            posts={posts}
            onDone={() => setAdding(false)}
          />
        ) : null}

        {tasks.length === 0 && !adding ? (
          <EmptyState
            title="Nothing on the checklist yet"
            description="Apply a plan above, or add a task by hand — either way it shows up on the calendar the moment it has a date."
          />
        ) : null}

        {open.length > 0 ? (
          <ul className="space-y-1.5">
            {open.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                clientName={task.client_id ? clientsById.get(task.client_id) ?? null : null}
                staffName={task.assigned_to ? staffById.get(task.assigned_to) ?? null : null}
                post={task.post_id ? postsById.get(task.post_id) ?? null : null}
                clients={clients}
                staff={staff}
                posts={posts}
                todayIso={todayIso}
              />
            ))}
          </ul>
        ) : null}

        {done.length > 0 ? (
          <details className="pt-1">
            <summary className="cursor-pointer text-xs font-medium text-muted hover:text-foreground">
              {done.length} done
            </summary>
            <ul className="mt-2 space-y-1.5">
              {done.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  clientName={task.client_id ? clientsById.get(task.client_id) ?? null : null}
                  staffName={task.assigned_to ? staffById.get(task.assigned_to) ?? null : null}
                  post={task.post_id ? postsById.get(task.post_id) ?? null : null}
                  clients={clients}
                  staff={staff}
                  posts={posts}
                  todayIso={todayIso}
                />
              ))}
            </ul>
          </details>
        ) : null}
      </CardBody>
    </Card>
  );
}

function TaskRow({
  task,
  clientName,
  staffName,
  post,
  clients,
  staff,
  posts,
  todayIso,
}: {
  task: CampaignTaskRow;
  clientName: string | null;
  staffName: string | null;
  post: ChecklistPostRef | null;
  clients: ClientRef[];
  staff: StaffRef[];
  posts: ChecklistPostRef[];
  todayIso: string;
}) {
  const done = Boolean(task.done_at);
  const [checked, setChecked] = useState(done);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    const next = !checked;
    setChecked(next);
    startTransition(async () => {
      const result = await toggleCampaignTask(
        IDLE,
        buildFormData({ taskId: task.id, done: String(next) }),
      );
      if (result.error) setChecked(!next);
    });
  }

  function handleDelete() {
    if (!window.confirm(`Remove “${task.title}” from the checklist?`)) return;
    startTransition(async () => {
      await deleteCampaignTask(IDLE, buildFormData({ taskId: task.id }));
    });
  }

  if (editing) {
    return (
      <li className="rounded-md border border-subtle bg-surface-raised p-3">
        <TaskForm
          campaignId={task.campaign_id}
          taskId={task.id}
          initial={task}
          clients={clients}
          staff={staff}
          posts={posts}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  const status = taskStatus(task, todayIso);

  return (
    <li
      className={cn(
        'flex items-start gap-3 rounded-md border border-subtle px-3 py-2.5 transition-opacity',
        pending && 'opacity-60',
      )}
    >
      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={checked}
        aria-label={checked ? 'Mark not done' : 'Mark done'}
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors',
          checked
            ? 'border-success bg-success text-white'
            : 'border-strong text-transparent hover:border-accent',
        )}
      >
        <Check size={13} aria-hidden="true" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              'text-sm font-medium text-foreground',
              checked && 'text-muted line-through',
            )}
          >
            {task.title}
          </span>
          <Badge tone={TASK_KIND_TONES[task.kind]}>{TASK_KIND_LABELS[task.kind]}</Badge>
          {!checked ? <Badge tone={TASK_STATUS_TONES[status]}>{TASK_STATUS_LABELS[status]}</Badge> : null}
        </div>

        {task.detail ? <p className="mt-0.5 text-xs text-muted">{task.detail}</p> : null}

        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-faint">
          {task.due_on ? (
            <span>
              {formatDateOnly(task.due_on)}
              {task.due_time ? ` · ${task.due_time.slice(0, 5)}` : ''}
            </span>
          ) : (
            <span>No date</span>
          )}
          {clientName ? <span>Client: {clientName}</span> : null}
          {staffName ? <span>Assigned: {staffName}</span> : null}
          {post ? <span>Linked to a {post.platform} post</span> : null}
        </p>
      </div>

      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Edit task"
          className="rounded-md p-1.5 text-faint transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <Pencil size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          aria-label="Delete task"
          className="rounded-md p-1.5 text-faint transition-colors hover:bg-danger-subtle hover:text-danger"
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

function TaskForm({
  campaignId,
  taskId,
  initial,
  clients,
  staff,
  posts,
  onDone,
}: {
  campaignId: string;
  taskId?: string;
  initial?: CampaignTaskRow;
  clients: ClientRef[];
  staff: StaffRef[];
  posts: ChecklistPostRef[];
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    if (!taskId) formData.set('campaignId', campaignId);
    else formData.set('taskId', taskId);

    startTransition(async () => {
      const result = taskId
        ? await updateCampaignTask(IDLE, formData)
        : await addCampaignTask(IDLE, formData);
      if (result.error) setError(result.error);
      else onDone();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="grid gap-3 sm:grid-cols-[2fr_10rem]">
        <Field label="Title" htmlFor={`task-title-${taskId ?? 'new'}`} required>
          <Input
            id={`task-title-${taskId ?? 'new'}`}
            name="title"
            defaultValue={initial?.title ?? ''}
            maxLength={200}
            required
            placeholder="Book meetings at the fair"
          />
        </Field>

        <Field label="Kind" htmlFor={`task-kind-${taskId ?? 'new'}`}>
          <Select
            id={`task-kind-${taskId ?? 'new'}`}
            name="kind"
            defaultValue={initial?.kind ?? ('admin' satisfies TaskKind)}
          >
            {TASK_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {TASK_KIND_LABELS[kind]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Detail" htmlFor={`task-detail-${taskId ?? 'new'}`}>
        <Textarea
          id={`task-detail-${taskId ?? 'new'}`}
          name="detail"
          rows={2}
          maxLength={1000}
          defaultValue={initial?.detail ?? ''}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Due date" htmlFor={`task-due-${taskId ?? 'new'}`}>
          <Input
            id={`task-due-${taskId ?? 'new'}`}
            name="dueOn"
            type="date"
            defaultValue={initial?.due_on ?? ''}
          />
        </Field>
        <Field label="Due time" htmlFor={`task-time-${taskId ?? 'new'}`}>
          <Input
            id={`task-time-${taskId ?? 'new'}`}
            name="dueTime"
            type="time"
            defaultValue={initial?.due_time ? initial.due_time.slice(0, 5) : ''}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Client"
          htmlFor={`task-client-${taskId ?? 'new'}`}
          hint="The CRM hook — link a follow-up to a real person."
        >
          <Select
            id={`task-client-${taskId ?? 'new'}`}
            name="clientId"
            defaultValue={initial?.client_id ?? ''}
          >
            <option value="">No client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Assigned to" htmlFor={`task-assignee-${taskId ?? 'new'}`}>
          <Select
            id={`task-assignee-${taskId ?? 'new'}`}
            name="assignedTo"
            defaultValue={initial?.assigned_to ?? ''}
          >
            <option value="">Unassigned</option>
            {staff.map((person) => (
              <option key={person.id} value={person.id}>
                {person.full_name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {posts.length > 0 ? (
        <Field
          label="Linked post"
          htmlFor={`task-post-${taskId ?? 'new'}`}
          hint="If this task is about writing or scheduling a specific post."
        >
          <Select
            id={`task-post-${taskId ?? 'new'}`}
            name="postId"
            defaultValue={initial?.post_id ?? ''}
          >
            <option value="">No linked post</option>
            {posts.map((post) => (
              <option key={post.id} value={post.id}>
                {post.platform} — {post.caption.slice(0, 60) || '(no caption yet)'}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? 'Saving…' : taskId ? 'Save task' : 'Add task'}
        </Button>
        <Button type="button" size="sm" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
