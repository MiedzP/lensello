'use client';

import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { deleteAutomationAction } from '../actions';

export function DeleteAutomationButton({ automationId, name }: { automationId: string; name: string }) {
  return (
    <form
      action={deleteAutomationAction}
      onSubmit={(event) => {
        if (!window.confirm(`Delete "${name}"? Its run history goes with it. This cannot be undone.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="automationId" value={automationId} />
      <Button type="submit" variant="danger" size="sm">
        <Trash2 size={14} aria-hidden="true" />
        Delete
      </Button>
    </form>
  );
}
