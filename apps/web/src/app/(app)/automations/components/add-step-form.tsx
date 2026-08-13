'use client';

import { Plus } from 'lucide-react';
import { Button, Select } from '@/components/ui';
import { ACTION_KINDS, ACTION_LABELS } from '@/lib/automations/types';
import { addStepAction } from '../actions';

export function AddStepForm({ automationId }: { automationId: string }) {
  return (
    <form action={addStepAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="automationId" value={automationId} />
      <Select name="actionKind" defaultValue={ACTION_KINDS[0]} className="w-auto min-w-56">
        {ACTION_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {ACTION_LABELS[kind]}
          </option>
        ))}
      </Select>
      <Button type="submit" variant="secondary">
        <Plus size={15} aria-hidden="true" />
        Add step
      </Button>
    </form>
  );
}
