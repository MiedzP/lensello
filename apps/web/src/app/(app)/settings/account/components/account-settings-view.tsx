'use client';

import { useActionState } from 'react';
import { Button, Field, Input, ErrorNote } from '@/components/ui';
import { changePassword, type AccountState } from '../actions';
import { Card } from '@/components/ui/card';

const INITIAL: AccountState = { error: null, success: false };

export default function AccountSettingsView() {
  const [state, action, pending] = useActionState(changePassword, INITIAL);

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-slate-900">Account Settings</h1>
        <p className="text-slate-600 mt-2">Manage your account security and password</p>
      </div>

      {/* Change Password Card */}
      <Card className="p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Change Password</h2>

        {state.success ? (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-6">
            <p className="text-sm text-green-800 font-medium">
              ✓ Your password has been updated successfully.
            </p>
          </div>
        ) : null}

        <form action={action} className="space-y-4">
          {state.error && !state.success ? (
            <ErrorNote>{state.error}</ErrorNote>
          ) : null}

          <Field label="Current Password" htmlFor="currentPassword" required>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              autoFocus
            />
          </Field>

          <Field label="New Password" htmlFor="newPassword" required>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
            />
          </Field>

          <Field label="Confirm New Password" htmlFor="confirmPassword" required>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
            />
          </Field>

          <Button
            type="submit"
            variant="primary"
            disabled={pending || state.success}
            className="mt-6"
          >
            {pending ? 'Updating password…' : 'Update Password'}
          </Button>
        </form>
      </Card>

      {/* Back to Settings */}
      <div>
        <a href="/settings/profile" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          ← Back to Business Profile
        </a>
      </div>
    </div>
  );
}
