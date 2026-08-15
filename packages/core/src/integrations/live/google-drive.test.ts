/**
 * The service-account handshake and request shapes, checked without Google.
 *
 * Mirrors `google-calendar.test.ts`: the JWT is verified against the public
 * half of a generated key pair, so a broken signature or a wrong scope fails
 * with the actual reason rather than an opaque `invalid_grant`.
 */

import { generateKeyPairSync, createVerify } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createGoogleDriveSource,
  isGoogleDriveConfigured,
  resetGoogleDriveToken,
} from './google-drive';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';

interface Call {
  url: string;
  method: string;
  body: string | undefined;
  headers: Record<string, string>;
}

function stubFetch(handler: (call: Call) => { status?: number; json?: unknown; body?: string; contentType?: string }): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', async (input: URL | string, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    const rawHeaders = init?.headers;
    if (rawHeaders instanceof Headers) {
      rawHeaders.forEach((value, key) => (headers[key] = value));
    } else if (rawHeaders) {
      Object.assign(headers, rawHeaders);
    }

    const call: Call = {
      url: String(input),
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? init.body : undefined,
      headers,
    };
    calls.push(call);
    const { status = 200, json, body, contentType } = handler(call);

    if (body !== undefined) {
      return new Response(body, {
        status,
        headers: { 'Content-Type': contentType ?? 'application/octet-stream' },
      });
    }
    return new Response(JSON.stringify(json ?? {}), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  return calls;
}

function respondWith(drive: { status?: number; json?: unknown; body?: string; contentType?: string }) {
  return (call: Call) =>
    call.url.startsWith(TOKEN_URL)
      ? { json: { access_token: 'test-token', expires_in: 3600 } }
      : drive;
}

function decodeJwt(assertion: string) {
  const [header, claims, signature] = assertion.split('.');
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${header}.${claims}`);

  return {
    signatureValid: verifier.verify(publicKey, Buffer.from(signature, 'base64url')),
    claims: JSON.parse(Buffer.from(claims, 'base64url').toString()) as Record<
      string,
      string | number
    >,
  };
}

function assertionFrom(calls: readonly Call[]): string {
  const token = calls.find((call) => call.url.startsWith(TOKEN_URL));
  expect(token, 'no token request was made').toBeDefined();
  return new URLSearchParams(token!.body).get('assertion')!;
}

describe('Google Drive service account', () => {
  beforeEach(() => {
    resetGoogleDriveToken();
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', 'studio@lensello.iam.gserviceaccount.com');
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', privateKey);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetGoogleDriveToken();
  });

  it('is unconfigured until both values are set', () => {
    expect(isGoogleDriveConfigured()).toBe(true);
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', '');
    expect(isGoogleDriveConfigured()).toBe(false);
  });

  it('signs an assertion Google can verify, scoped to read-only Drive access', async () => {
    const calls = stubFetch(respondWith({ json: { files: [] } }));
    await createGoogleDriveSource().listFolders();

    const { signatureValid, claims } = decodeJwt(assertionFrom(calls));

    expect(signatureValid).toBe(true);
    expect(claims.iss).toBe('studio@lensello.iam.gserviceaccount.com');
    expect(claims.aud).toBe(TOKEN_URL);
    expect(claims.scope).toBe('https://www.googleapis.com/auth/drive.readonly');
  });

  it('mints one token for many calls', async () => {
    const calls = stubFetch(respondWith({ json: { files: [] } }));
    const drive = createGoogleDriveSource();

    await drive.listFolders();
    await drive.listImages('folder1');

    expect(calls.filter((call) => call.url.startsWith(TOKEN_URL))).toHaveLength(1);
  });

  it('lists only folders, never the whole Drive', async () => {
    const calls = stubFetch(
      respondWith({
        json: { files: [{ id: 'f1', name: 'Weddings' }, { id: 'f2', name: 'Family' }] },
      }),
    );

    const folders = await createGoogleDriveSource().listFolders();

    expect(folders).toEqual([
      { id: 'f1', name: 'Weddings' },
      { id: 'f2', name: 'Family' },
    ]);

    const list = calls.find((call) => call.url.includes('/files?'))!;
    const q = new URL(list.url).searchParams.get('q')!;
    expect(q).toContain("mimeType = 'application/vnd.google-apps.folder'");
  });

  it("scopes listImages to one folder's direct children, not subfolders", async () => {
    const calls = stubFetch(
      respondWith({
        json: {
          files: [
            {
              id: 'img1',
              name: 'speech.jpg',
              mimeType: 'image/jpeg',
              size: '204800',
              modifiedTime: '2026-07-01T00:00:00Z',
              imageMediaMetadata: { width: 4000, height: 2667 },
            },
          ],
        },
      }),
    );

    const images = await createGoogleDriveSource().listImages('folder_xyz');

    expect(images).toEqual([
      {
        id: 'img1',
        name: 'speech.jpg',
        mimeType: 'image/jpeg',
        byteSize: 204800,
        width: 4000,
        height: 2667,
        modifiedTime: '2026-07-01T00:00:00Z',
      },
    ]);

    const list = calls.find((call) => call.url.includes('/files?'))!;
    const q = new URL(list.url).searchParams.get('q')!;
    expect(q).toContain("'folder_xyz' in parents");
    expect(q).toContain("mimeType contains 'image/'");
  });

  it('walks every page of a large folder', async () => {
    let page = 0;
    stubFetch((call) => {
      if (call.url.startsWith(TOKEN_URL)) return { json: { access_token: 't', expires_in: 3600 } };
      page += 1;
      if (page === 1) {
        return {
          json: {
            files: [{ id: 'a', name: 'a.jpg', mimeType: 'image/jpeg', size: '1' }],
            nextPageToken: 'p2',
          },
        };
      }
      return { json: { files: [{ id: 'b', name: 'b.jpg', mimeType: 'image/jpeg', size: '1' }] } };
    });

    const images = await createGoogleDriveSource().listImages('folder1');
    expect(images.map((image) => image.id)).toEqual(['a', 'b']);
  });

  it('names the missed sharing step when a folder is not found', async () => {
    stubFetch(respondWith({ status: 404, json: { error: { message: 'Not Found' } } }));

    await expect(createGoogleDriveSource().listImages('missing')).rejects.toThrow(
      /shared with the service account/,
    );
  });

  it('downloads the original bytes of a file with alt=media', async () => {
    const calls = stubFetch(respondWith({ body: 'fake-jpeg-bytes', contentType: 'image/jpeg' }));

    const file = await createGoogleDriveSource().downloadFile('img1');

    expect(Buffer.from(file.bytes).toString()).toBe('fake-jpeg-bytes');
    expect(file.mimeType).toBe('image/jpeg');

    const download = calls.find((call) => call.url.includes('/files/img1'))!;
    expect(new URL(download.url).searchParams.get('alt')).toBe('media');
  });

  it('falls back to null for a thumbnail rather than downloading the original', async () => {
    stubFetch(respondWith({ status: 404, json: { error: { message: 'no thumbnail' } } }));

    const thumb = await createGoogleDriveSource().fetchThumbnail('img1');
    expect(thumb).toBeNull();
  });

  it('fetches a thumbnail when Drive offers one', async () => {
    stubFetch((call) => {
      if (call.url.startsWith(TOKEN_URL)) return { json: { access_token: 't', expires_in: 3600 } };
      if (call.url.includes('fields=thumbnailLink')) {
        return { json: { thumbnailLink: 'https://drive.example.invalid/thumb/img1' } };
      }
      if (call.url.startsWith('https://drive.example.invalid/')) {
        return { body: 'thumb-bytes', contentType: 'image/jpeg' };
      }
      return { status: 404, json: {} };
    });

    const thumb = await createGoogleDriveSource().fetchThumbnail('img1');
    expect(thumb).not.toBeNull();
    expect(Buffer.from(thumb!.bytes).toString()).toBe('thumb-bytes');
  });
});
