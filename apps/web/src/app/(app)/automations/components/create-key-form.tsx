'use client';

import { useActionState, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button, Card, CardBody, CardFooter, CardHeader, ErrorNote, Field, Input } from '@/components/ui';
import { IDLE_KEY_STATE } from '@/lib/automations/action-state';
import { API_KEY_SCOPE_VALUES } from '@/lib/automations/schemas';
import { createApiKeyAction } from '../actions';

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  'automations:read': 'List automations and read their run history.',
  'automations:trigger': 'Trigger a webhook- or manual-trigger automation.',
};

export function CreateKeyForm() {
  const [state, action, pending] = useActionState(createApiKeyAction, IDLE_KEY_STATE);
  const [copied, setCopied] = useState(false);

  if (state.mintedKey) {
    return (
      <Card>
        <CardHeader title="Key created" description="This is shown once. It cannot be recovered — only revoked and replaced." />
        <CardBody className="space-y-3">
          <div className="flex items-center gap-2 rounded-md border border-strong bg-surface-raised px-3 py-2">
            <code className="flex-1 overflow-x-auto text-sm text-foreground">{state.mintedKey}</code>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(state.mintedKey ?? '');
                setCopied(true);
              }}
            >
              {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="text-xs text-muted">Store it somewhere safe. Refreshing this page will not bring it back.</p>
        </CardBody>
        <CardFooter>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Done
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="New API key" description="Least privilege by default — a key with no scopes ticked can do nothing." />
      <form action={action}>
        <CardBody className="space-y-4">
          {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}

          <Field label="Name" htmlFor="name" required hint="What is this key for? e.g. “Zapier”.">
            <Input id="name" name="name" maxLength={120} required />
          </Field>

          <fieldset>
            <legend className="text-sm font-medium text-foreground">Scopes</legend>
            <div className="mt-2 space-y-2">
              {API_KEY_SCOPE_VALUES.map((scope) => (
                <label key={scope} className="flex items-start gap-2 text-sm text-foreground">
                  <input type="checkbox" name="scopes" value={scope} className="mt-0.5 size-4 accent-accent" />
                  <span>
                    <span className="font-mono text-xs">{scope}</span>
                    <span className="block text-xs text-muted">{SCOPE_DESCRIPTIONS[scope]}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </CardBody>
        <CardFooter className="justify-end">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Creating…' : 'Create key'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
