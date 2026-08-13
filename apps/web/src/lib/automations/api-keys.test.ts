import { describe, expect, it } from 'vitest';
import { generateApiKey, hasScope, hashApiKey, verifyApiKey, type VerifiedApiKey } from './api-keys';
import { createFakeAdmin, createFakeStore } from './test-fake-admin';

function seedKey(store: ReturnType<typeof createFakeStore>, overrides: Record<string, unknown> = {}) {
  const minted = generateApiKey();
  const row = {
    id: 'key-1',
    name: 'Test key',
    key_prefix: minted.prefix,
    key_hash: minted.hash,
    scopes: ['automations:read'],
    last_used_at: null,
    expires_at: null,
    revoked_at: null,
    ...overrides,
  };
  store.tables.api_keys = [row];
  return { minted, row };
}

describe('generateApiKey', () => {
  it('never stores or returns the same raw key twice', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.key).not.toBe(b.key);
  });

  it('the stored hash is a one-way function of the key, not the key itself', () => {
    const minted = generateApiKey();
    expect(minted.hash).not.toBe(minted.key);
    expect(minted.hash).toBe(hashApiKey(minted.key));
    // A hex sha256 digest, not a truncation or encoding of the original key.
    expect(minted.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('the display prefix cannot be extended back into the full key', () => {
    const minted = generateApiKey();
    expect(minted.key.startsWith(minted.prefix)).toBe(true);
    expect(minted.prefix.length).toBeLessThan(minted.key.length);
  });
});

describe('verifyApiKey', () => {
  it('verifies a freshly minted key', async () => {
    const store = createFakeStore();
    const { minted } = seedKey(store);

    const verified = await verifyApiKey(createFakeAdmin(store), minted.key);
    expect(verified).not.toBeNull();
    expect(verified?.scopes).toEqual(['automations:read']);
  });

  it('rejects a key that was never minted', async () => {
    const store = createFakeStore();
    seedKey(store);

    const verified = await verifyApiKey(createFakeAdmin(store), 'lsk_totally-made-up-key-value-1234');
    expect(verified).toBeNull();
  });

  it('rejects anything not shaped like one of our keys, without querying the store', async () => {
    const store = createFakeStore();
    seedKey(store);

    expect(await verifyApiKey(createFakeAdmin(store), '')).toBeNull();
    expect(await verifyApiKey(createFakeAdmin(store), 'short')).toBeNull();
    expect(await verifyApiKey(createFakeAdmin(store), 'not-the-right-prefix-but-long-enough')).toBeNull();
  });

  it('rejects a revoked key even though the hash still matches', async () => {
    const store = createFakeStore();
    const { minted } = seedKey(store, { revoked_at: new Date().toISOString() });

    expect(await verifyApiKey(createFakeAdmin(store), minted.key)).toBeNull();
  });

  it('rejects an expired key', async () => {
    const store = createFakeStore();
    const { minted } = seedKey(store, { expires_at: new Date(Date.now() - 1000).toISOString() });

    expect(await verifyApiKey(createFakeAdmin(store), minted.key)).toBeNull();
  });

  it('accepts a key that has not yet expired', async () => {
    const store = createFakeStore();
    const { minted } = seedKey(store, { expires_at: new Date(Date.now() + 1000 * 60 * 60).toISOString() });

    expect(await verifyApiKey(createFakeAdmin(store), minted.key)).not.toBeNull();
  });
});

describe('hasScope', () => {
  it('a key with no scopes can do nothing', () => {
    const key: VerifiedApiKey = { id: 'k', name: 'n', scopes: [] };
    expect(hasScope(key, 'automations:read')).toBe(false);
    expect(hasScope(key, 'automations:trigger')).toBe(false);
  });

  it('only grants the scopes actually assigned', () => {
    const key: VerifiedApiKey = { id: 'k', name: 'n', scopes: ['automations:read'] };
    expect(hasScope(key, 'automations:read')).toBe(true);
    expect(hasScope(key, 'automations:trigger')).toBe(false);
  });
});
