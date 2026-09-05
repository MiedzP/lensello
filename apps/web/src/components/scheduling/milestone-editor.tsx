'use client';

import { useState } from 'react';
import { Card, CardHeader, CardBody, CardFooter, Button, Input, Field } from '@/components/ui';
import { Textarea } from '@/components/ui/field';

export interface MilestoneEditorProps {
  templateId?: string;
  initialData?: {
    id?: string;
    title: string;
    description?: string;
    days_offset?: number;
    business_days_only?: boolean;
  };
  onSubmit?: (data: any) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

/**
 * Form to add or edit a milestone
 * Allows setting title, description, day offset, and business days flag
 */
export function MilestoneEditor({
  templateId,
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: MilestoneEditorProps) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [daysOffset, setDaysOffset] = useState(
    initialData?.days_offset?.toString() || '0'
  );
  const [businessDaysOnly, setBusinessDaysOnly] = useState(
    initialData?.business_days_only || false
  );
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Milestone title is required');
      return;
    }

    try {
      const formData = new FormData();
      if (initialData?.id) {
        formData.append('milestoneId', initialData.id);
      } else if (templateId) {
        formData.append('templateId', templateId);
      }
      formData.append('title', title);
      formData.append('description', description);
      formData.append('daysOffset', daysOffset);
      if (businessDaysOnly) {
        formData.append('businessDaysOnly', 'on');
      }

      await onSubmit?.(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  return (
    <Card>
      <CardHeader
        title={initialData?.id ? 'Edit Milestone' : 'Add Milestone'}
        description="Define when this milestone occurs and what actions trigger"
      />
      <form onSubmit={handleSubmit}>
        <CardBody className="space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded p-3">
              <p className="text-sm text-red-800 dark:text-red-100">{error}</p>
            </div>
          )}

          <Field>
            <label className="block text-sm font-medium text-foreground mb-2">
              Milestone Title <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Send proofs, Final delivery, Follow-up"
              disabled={isLoading}
              required
            />
          </Field>

          <Field>
            <label className="block text-sm font-medium text-foreground mb-2">
              Description (optional)
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details about this milestone"
              rows={2}
              disabled={isLoading}
            />
          </Field>

          <Field>
            <label className="block text-sm font-medium text-foreground mb-2">
              Days After Timeline Start
            </label>
            <Input
              type="number"
              min="0"
              value={daysOffset}
              onChange={(e) => setDaysOffset(e.target.value)}
              disabled={isLoading}
              placeholder="0"
            />
            <p className="text-xs text-muted mt-1">
              0 = start date, 1 = next day, 7 = one week, etc.
            </p>
          </Field>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={businessDaysOnly}
              onChange={(e) => setBusinessDaysOnly(e.target.checked)}
              disabled={isLoading}
              className="w-4 h-4 rounded border-subtle"
            />
            <span className="text-sm font-medium text-foreground">
              Skip weekends (business days only)
            </span>
          </label>
        </CardBody>

        <CardFooter>
          {onCancel && (
            <Button
              variant="secondary"
              onClick={onCancel}
              disabled={isLoading}
              type="button"
            >
              Cancel
            </Button>
          )}
          <Button
            variant="primary"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : 'Save Milestone'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
