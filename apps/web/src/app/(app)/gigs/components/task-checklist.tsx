import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from 'lucide-react';
import { Button, Card, CardBody, CardHeader, Input } from '@/components/ui';
import { cn, pluralize } from '@/lib/utils';
import type { GigTaskRow } from '@/lib/gigs/types';
import {
  addGigTask,
  deleteGigTask,
  moveGigTask,
  renameGigTask,
  toggleGigTask,
} from '../actions';

/**
 * Shot list, call times, gear reminders.
 *
 * Deliberately a Server Component with plain `<form action={...}>` controls: it
 * works before hydration and with JavaScript off, which matters for a checklist
 * you tick off on a phone at a venue with bad signal. Each control is its own
 * form because forms cannot nest.
 *
 * Order is `position`, renumbered densely on every move — 0001 defaults every
 * row's position to 0, so swapping raw values would be a no-op on a checklist
 * that arrived without explicit ordering.
 */
export function TaskChecklist({ gigId, tasks }: { gigId: string; tasks: GigTaskRow[] }) {
  const done = tasks.filter((task) => task.is_done).length;

  return (
    <Card>
      <CardHeader
        title="Checklist"
        description={
          tasks.length === 0
            ? 'Shot list, call times, gear'
            : `${done} of ${pluralize(tasks.length, 'task')} done`
        }
      />

      <CardBody className="space-y-4">
        {tasks.length === 0 ? (
          <p className="rounded-md border border-dashed border-strong px-4 py-6 text-center text-sm text-muted">
            Nothing on the list yet. Add the first thing you must not forget —
            “confirm call time”, “pack 85mm”, “family group shot list”.
          </p>
        ) : (
          <ol className="space-y-1.5">
            {tasks.map((task, index) => (
              <li key={task.id} className="flex items-center gap-1.5">
                <form action={toggleGigTask} className="shrink-0">
                  <input type="hidden" name="gigId" value={gigId} />
                  <input type="hidden" name="taskId" value={task.id} />
                  <button
                    type="submit"
                    aria-pressed={task.is_done}
                    aria-label={
                      task.is_done
                        ? `Mark “${task.label}” as not done`
                        : `Mark “${task.label}” as done`
                    }
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded border transition-colors',
                      task.is_done
                        ? 'border-success bg-success-subtle text-success'
                        : 'border-strong text-transparent hover:bg-surface-hover hover:text-faint',
                    )}
                  >
                    <Check size={14} aria-hidden="true" />
                  </button>
                </form>

                {/* Edit the text and press Enter. The submit button is visually
                    hidden but reachable by keyboard, so this is not a
                    mouse-only affordance. */}
                <form action={renameGigTask} className="flex min-w-0 flex-1 items-center gap-1">
                  <input type="hidden" name="gigId" value={gigId} />
                  <input type="hidden" name="taskId" value={task.id} />
                  <Input
                    name="label"
                    defaultValue={task.label}
                    aria-label={`Task ${index + 1} of ${tasks.length}`}
                    className={cn(
                      'h-8 border-transparent bg-transparent px-2 text-sm',
                      'hover:border-strong focus:border-strong',
                      task.is_done && 'text-muted line-through',
                    )}
                  />
                  <button
                    type="submit"
                    className="sr-only rounded-md px-2 py-1 text-xs font-medium text-accent focus:not-sr-only focus:relative focus:bg-accent-subtle"
                  >
                    Save name
                  </button>
                </form>

                <div className="flex shrink-0 items-center">
                  <MoveButton
                    gigId={gigId}
                    taskId={task.id}
                    direction="up"
                    label={`Move “${task.label}” up`}
                    disabled={index === 0}
                  />
                  <MoveButton
                    gigId={gigId}
                    taskId={task.id}
                    direction="down"
                    label={`Move “${task.label}” down`}
                    disabled={index === tasks.length - 1}
                  />

                  <form action={deleteGigTask}>
                    <input type="hidden" name="gigId" value={gigId} />
                    <input type="hidden" name="taskId" value={task.id} />
                    <button
                      type="submit"
                      aria-label={`Delete “${task.label}”`}
                      className="flex h-7 w-7 items-center justify-center rounded text-faint transition-colors hover:bg-danger-subtle hover:text-danger"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ol>
        )}

        <form action={addGigTask} className="flex items-end gap-2 border-t border-subtle pt-4">
          <input type="hidden" name="gigId" value={gigId} />
          <div className="flex-1">
            <label
              htmlFor="new-task-label"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Add a task
            </label>
            <Input
              id="new-task-label"
              name="label"
              required
              maxLength={200}
              placeholder="Confirm call time with the venue"
            />
          </div>
          <Button type="submit" variant="secondary">
            <Plus size={15} aria-hidden="true" />
            Add
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function MoveButton({
  gigId,
  taskId,
  direction,
  label,
  disabled,
}: {
  gigId: string;
  taskId: string;
  direction: 'up' | 'down';
  label: string;
  disabled: boolean;
}) {
  const Icon = direction === 'up' ? ArrowUp : ArrowDown;

  return (
    <form action={moveGigTask}>
      <input type="hidden" name="gigId" value={gigId} />
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        aria-label={label}
        className="flex h-7 w-7 items-center justify-center rounded text-faint transition-colors hover:bg-surface-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <Icon size={14} aria-hidden="true" />
      </button>
    </form>
  );
}
