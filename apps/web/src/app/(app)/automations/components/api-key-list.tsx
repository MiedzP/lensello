'use client';

import { Badge, Button, Card, CardHeader, EmptyState } from '@/components/ui';
import type { ApiKeyRow } from '@/lib/automations/types';
import { revokeApiKeyAction } from '../actions';

function isExpired(key: ApiKeyRow): boolean {
  return Boolean(key.expires_at && new Date(key.expires_at).getTime() <= Date.now());
}

export function ApiKeyList({ keys }: { keys: ApiKeyRow[] }) {
  if (keys.length === 0) {
    return (
      <Card>
        <CardHeader title="Existing keys" />
        <EmptyState title="No keys yet" description="Create one above to authenticate a call to /api/v1." />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Existing keys" description="Only the prefix is ever shown again — the rest is a one-way hash." />
      <div className="divide-y divide-subtle">
        {keys.map((key) => {
          const revoked = Boolean(key.revoked_at);
          const expired = isExpired(key);
          return (
            <div key={key.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{key.name}</p>
                  {revoked ? (
                    <Badge tone="danger">Revoked</Badge>
                  ) : expired ? (
                    <Badge tone="warning">Expired</Badge>
                  ) : (
                    <Badge tone="success">Active</Badge>
                  )}
                </div>
                <p className="mt-0.5 font-mono text-xs text-muted">
                  {key.key_prefix}… · {key.scopes.length === 0 ? 'no scopes (can do nothing)' : key.scopes.join(', ')}
                </p>
                <p className="text-xs text-faint">
                  {key.last_used_at ? `Last used ${new Date(key.last_used_at).toLocaleString()}` : 'Never used'}
                </p>
              </div>
              {!revoked ? (
                <form
                  action={revokeApiKeyAction}
                  onSubmit={(event) => {
                    if (!window.confirm(`Revoke "${key.name}"? Anything using it will stop working immediately.`)) {
                      event.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="keyId" value={key.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Revoke
                  </Button>
                </form>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
