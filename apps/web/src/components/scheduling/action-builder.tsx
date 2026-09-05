'use client';

import { useState } from 'react';
import { Card, CardHeader, CardBody, CardFooter, Button, Input, Select, Field } from '@/components/ui';
import { Textarea } from '@/components/ui/field';

export interface ActionBuilderProps {
  milestoneId?: string;
  initialData?: {
    id?: string;
    action_type: 'email' | 'task' | 'sms' | 'call';
    title: string;
    content?: string;
    recipient_type?: string;
    recipient_email?: string;
    recipient_phone?: string;
  };
  onSubmit?: (data: FormData) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

/**
 * Form to add or edit an action on a milestone
 * Supports email, task, SMS, and call action types
 */
export function ActionBuilder({
  milestoneId,
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: ActionBuilderProps) {
  const [actionType, setActionType] = useState<'email' | 'task' | 'sms' | 'call'>(
    initialData?.action_type || 'email'
  );
  const [title, setTitle] = useState(initialData?.title || '');
  const [content, setContent] = useState(initialData?.content || '');
  const [recipientType, setRecipientType] = useState(
    initialData?.recipient_type || 'client'
  );
  const [recipientEmail, setRecipientEmail] = useState(
    initialData?.recipient_email || ''
  );
  const [recipientPhone, setRecipientPhone] = useState(
    initialData?.recipient_phone || ''
  );
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Action title is required');
      return;
    }

    if (recipientType === 'custom') {
      if (actionType === 'email' && !recipientEmail) {
        setError('Email address required for custom recipient');
        return;
      }
      if ((actionType === 'sms' || actionType === 'call') && !recipientPhone) {
        setError('Phone number required for custom recipient');
        return;
      }
    }

    try {
      const formData = new FormData();
      if (initialData?.id) {
        formData.append('actionId', initialData.id);
      } else if (milestoneId) {
        formData.append('milestoneId', milestoneId);
      }
      formData.append('actionType', actionType);
      formData.append('title', title);
      formData.append('content', content);
      formData.append('recipientType', recipientType);
      if (recipientEmail) formData.append('recipientEmail', recipientEmail);
      if (recipientPhone) formData.append('recipientPhone', recipientPhone);

      await onSubmit?.(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  return (
    <Card>
      <CardHeader
        title={initialData?.id ? 'Edit Action' : 'Add Action'}
        description="Define what happens at this milestone"
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
              Action Type <span className="text-red-500">*</span>
            </label>
            <Select
              value={actionType}
              onChange={(e) => setActionType(e.target.value as any)}
              disabled={isLoading}
            >
              <option value="email">📧 Email</option>
              <option value="task">✓ Task</option>
              <option value="sms">💬 SMS</option>
              <option value="call">☎️ Call</option>
            </Select>
          </Field>

          <Field>
            <label className="block text-sm font-medium text-foreground mb-2">
              Action Title <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                actionType === 'email'
                  ? 'e.g., Send proofs to client'
                  : actionType === 'task'
                  ? 'e.g., Review photos'
                  : 'e.g., Follow up with client'
              }
              disabled={isLoading}
              required
            />
          </Field>

          {actionType === 'email' && (
            <Field>
              <label className="block text-sm font-medium text-foreground mb-2">
                Email Content
              </label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Email body (markdown supported)"
                rows={4}
                disabled={isLoading}
              />
            </Field>
          )}

          {actionType === 'task' && (
            <Field>
              <label className="block text-sm font-medium text-foreground mb-2">
                Task Details
              </label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Task description"
                rows={3}
                disabled={isLoading}
              />
            </Field>
          )}

          <Field>
            <label className="block text-sm font-medium text-foreground mb-2">
              Recipient
            </label>
            <Select
              value={recipientType}
              onChange={(e) => setRecipientType(e.target.value)}
              disabled={isLoading}
            >
              <option value="client">Client</option>
              <option value="self">Myself (Internal)</option>
              <option value="custom">Custom</option>
            </Select>
          </Field>

          {recipientType === 'custom' && (
            <>
              {(actionType === 'email') && (
                <Field>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="recipient@example.com"
                    disabled={isLoading}
                  />
                </Field>
              )}

              {(actionType === 'sms' || actionType === 'call') && (
                <Field>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Phone Number
                  </label>
                  <Input
                    type="tel"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    disabled={isLoading}
                  />
                </Field>
              )}
            </>
          )}
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
            {isLoading ? 'Saving...' : 'Save Action'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
