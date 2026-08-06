import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, isEncryptionConfigured } from './secret-box';

/** A valid 32-byte key, so tests do not depend on the deployment's real one. */
const KEY = Buffer.alloc(32, 7).toString('base64');
const OTHER_KEY = Buffer.alloc(32, 9).toString('base64');

describe('secret-box', () => {
  const original = process.env.LENSELLO_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.LENSELLO_ENCRYPTION_KEY = KEY;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.LENSELLO_ENCRYPTION_KEY;
    else process.env.LENSELLO_ENCRYPTION_KEY = original;
  });

  it('round-trips a password unchanged', () => {
    const secret = 'abcd efgh ijkl mnop';
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it('round-trips non-ASCII, so a passphrase is not silently mangled', () => {
    const secret = 'pässwörd–✓🔐';
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it('produces a different ciphertext each time for the same input', () => {
    // A fresh IV per encryption. Identical ciphertexts would leak that two
    // mailboxes share a password.
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'));
  });

  it('refuses to decrypt with a different key', () => {
    const encoded = encryptSecret('secret');
    process.env.LENSELLO_ENCRYPTION_KEY = OTHER_KEY;
    expect(() => decryptSecret(encoded)).toThrow();
  });

  it('rejects a tampered ciphertext rather than returning rubbish', () => {
    // The whole reason for GCM over CBC: a flipped byte must fail loudly, not
    // decrypt to something that gets handed to a mail server.
    const encoded = encryptSecret('secret');
    const parts = encoded.split('.');
    const body = Buffer.from(parts[3]!, 'base64url');
    body[0] = body[0]! ^ 0xff;
    parts[3] = body.toString('base64url');

    expect(() => decryptSecret(parts.join('.'))).toThrow();
  });

  it('rejects a truncated or unversioned value', () => {
    expect(() => decryptSecret('not-a-secret')).toThrow(/recognised format/);
    expect(() => decryptSecret('v2.a.b.c')).toThrow(/recognised format/);
  });

  it('fails closed when the key is missing', () => {
    delete process.env.LENSELLO_ENCRYPTION_KEY;
    expect(isEncryptionConfigured()).toBe(false);
    expect(() => encryptSecret('secret')).toThrow(/not set/);
  });

  it('rejects a key of the wrong length instead of padding it', () => {
    process.env.LENSELLO_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString('base64');
    expect(isEncryptionConfigured()).toBe(false);
    expect(() => encryptSecret('secret')).toThrow(/32 bytes/);
  });
});
