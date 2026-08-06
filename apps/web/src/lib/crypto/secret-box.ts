/**
 * Authenticated encryption for credentials at rest.
 *
 * `mailbox_secrets` is already unreachable from any user session — RLS on, no
 * policies — so this is defence in depth rather than the primary control. It
 * buys one specific thing: a leaked service-role key is no longer sufficient to
 * log in to the studio's mailbox, because the key that decrypts the password
 * lives in the environment rather than the database. An attacker needs both.
 *
 * AES-256-GCM, so tampering with the stored ciphertext fails loudly on decrypt
 * instead of yielding a corrupted password that produces a confusing IMAP
 * error.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
/** 96 bits is the size GCM is specified for; longer nonces are rehashed. */
const IV_BYTES = 12;
const VERSION = 'v1';

function loadKey(): Buffer {
  const raw = process.env.LENSELLO_ENCRYPTION_KEY?.trim();

  if (!raw) {
    throw new Error(
      'LENSELLO_ENCRYPTION_KEY is not set, so mailbox passwords cannot be ' +
        'stored or read. Generate one with: openssl rand -base64 32',
    );
  }

  const key = Buffer.from(raw, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `LENSELLO_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes; got ${key.length}. ` +
        'Generate one with: openssl rand -base64 32',
    );
  }
  return key;
}

/** True when encryption is usable, for UI that must not offer a doomed form. */
export function isEncryptionConfigured(): boolean {
  try {
    loadKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns `v1.<iv>.<tag>.<ciphertext>`, all base64url.
 *
 * The version prefix is there so a future key rotation or algorithm change can
 * recognise and migrate old values rather than failing to decrypt them.
 */
export function encryptSecret(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function decryptSecret(encoded: string): string {
  const key = loadKey();
  const parts = encoded.split('.');

  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Stored secret is not in a recognised format.');
  }

  const iv = Buffer.from(parts[1]!, 'base64url');
  const tag = Buffer.from(parts[2]!, 'base64url');
  const ciphertext = Buffer.from(parts[3]!, 'base64url');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  // Throws on a bad tag, which is the point: a tampered or truncated value
  // must not decrypt to something that gets sent to a mail server.
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
