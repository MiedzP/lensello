/**
 * Live Drive adapter: Google Drive, via the same service-account pattern as
 * `google-calendar.ts`.
 *
 * Exactly the same reasoning as the calendar adapter: OAuth against the
 * photographer's own account would need Google's app-review process for a
 * sensitive scope, and an unverified app's tokens would expire weekly. A
 * service account sidesteps it — the studio **shares a Drive folder with the
 * service account's email address**, the same way they would share it with an
 * assistant, and this adapter can then see exactly that folder and nothing
 * else in the account.
 *
 * Read-only scope on purpose (`drive.readonly`): importing only ever reads
 * from Drive, and a compromised key that can only read is a smaller problem
 * than one that can also delete or overwrite the studio's own files.
 *
 * UNVERIFIED — like the calendar adapter, this has never run against Google's
 * API. The JWT assertion flow is shared with (and proven by) the calendar
 * adapter's tests; the Drive v3 request/response shapes here are well
 * specified but treat the first real run as a test.
 */

import { IntegrationError } from '../types';
import type { DriveFile, DriveFolder, DriveImage, DriveSource } from '../types';
import {
  exchangeServiceAccountAssertion,
  normaliseServiceAccountKey,
  signServiceAccountAssertion,
} from './google-auth';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const REFRESH_MARGIN_SECONDS = 60;

/** Drive pages at up to 1000; this caps total pages walked per call. */
const MAX_PAGES = 20;

export function isGoogleDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim(),
  );
}

function requireConfig(): { email: string; privateKey: string } {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new IntegrationError(
      'Google Drive is not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and ' +
        'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.',
      'google-drive',
    );
  }

  return { email, privateKey: normaliseServiceAccountKey(rawKey) };
}

let cached: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.expiresAt - REFRESH_MARGIN_SECONDS > now) return cached.token;

  const { email, privateKey } = requireConfig();
  const assertion = signServiceAccountAssertion({
    email,
    privateKey,
    scope: SCOPE,
    provider: 'google-drive',
  });

  cached = await exchangeServiceAccountAssertion(assertion, 'google-drive');
  return cached.token;
}

/** Test seam: drops the cached access token. */
export function resetGoogleDriveToken(): void {
  cached = null;
}

interface GoogleApiError {
  error?: { message?: string; code?: number };
}

async function apiGet<T>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const token = await accessToken();
  const url = new URL(`${DRIVE_API}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  let response: Response;
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch (cause) {
    throw new IntegrationError(
      `Could not reach Google Drive: ${cause instanceof Error ? cause.message : 'network error'}.`,
      'google-drive',
      true,
    );
  }

  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as unknown) : {};

  if (!response.ok) {
    const detail = (parsed as GoogleApiError).error?.message ?? `HTTP ${response.status}`;
    // 404 on a specific file/folder id almost always means it was never
    // shared with the service account — the one setup step people miss.
    const hint =
      response.status === 404
        ? ' Check the folder is shared with the service account address.'
        : '';
    throw new IntegrationError(
      `Google Drive: ${detail}.${hint}`,
      'google-drive',
      response.status === 429 || response.status >= 500,
    );
  }

  return parsed as T;
}

interface GoogleDriveFile {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: string;
  modifiedTime?: string;
  imageMediaMetadata?: { width?: number; height?: number };
}

/** Walks every page of a Drive `files.list` query, up to `MAX_PAGES`. */
async function listAllFiles(query: string, fields: string): Promise<GoogleDriveFile[]> {
  const files: GoogleDriveFile[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await apiGet<{ files?: GoogleDriveFile[]; nextPageToken?: string }>(
      '/files',
      {
        q: query,
        fields: `nextPageToken, files(${fields})`,
        pageSize: '1000',
        spaces: 'drive',
        ...(pageToken ? { pageToken } : {}),
      },
    );

    files.push(...(response.files ?? []));
    pageToken = response.nextPageToken;
    if (!pageToken) break;
  }

  return files;
}

/** Escapes a value for embedding in a Drive `q` query string literal. */
function qLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function toDriveImage(file: GoogleDriveFile): DriveImage | null {
  if (!file.id || !file.name || !file.mimeType) return null;
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    byteSize: file.size ? Number.parseInt(file.size, 10) || 0 : 0,
    width: file.imageMediaMetadata?.width ?? null,
    height: file.imageMediaMetadata?.height ?? null,
    modifiedTime: file.modifiedTime ?? new Date(0).toISOString(),
  };
}

class GoogleDriveSource implements DriveSource {
  readonly provider = 'google-drive';

  async listFolders(): Promise<DriveFolder[]> {
    const files = await listAllFiles(
      "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      'id, name',
    );

    return files.flatMap((file) => (file.id && file.name ? [{ id: file.id, name: file.name }] : []));
  }

  async listImages(folderId: string): Promise<DriveImage[]> {
    const files = await listAllFiles(
      `'${qLiteral(folderId)}' in parents and trashed = false and mimeType contains 'image/'`,
      'id, name, mimeType, size, modifiedTime, imageMediaMetadata(width, height)',
    );

    return files.flatMap((file) => {
      const image = toDriveImage(file);
      return image ? [image] : [];
    });
  }

  async downloadFile(fileId: string): Promise<DriveFile> {
    const token = await accessToken();
    const url = new URL(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`);
    url.searchParams.set('alt', 'media');

    let response: Response;
    try {
      response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    } catch (cause) {
      throw new IntegrationError(
        `Could not reach Google Drive: ${cause instanceof Error ? cause.message : 'network error'}.`,
        'google-drive',
        true,
      );
    }

    if (!response.ok) {
      const hint =
        response.status === 404
          ? ' Check the file is shared with the service account address.'
          : '';
      throw new IntegrationError(
        `Google Drive: could not download the file (HTTP ${response.status}).${hint}`,
        'google-drive',
        response.status === 429 || response.status >= 500,
      );
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    const mimeType = response.headers.get('content-type') ?? 'application/octet-stream';
    return { bytes, mimeType };
  }

  async fetchThumbnail(fileId: string): Promise<DriveFile | null> {
    // `thumbnailLink` is a best-effort field: Google does not guarantee it is
    // present, and it can require the request to have come from the same
    // account context that generated it — which is not a settled question for
    // a service account and has not been proven against the real API (see the
    // module comment). Any failure here falls back to null so the browse grid
    // shows a placeholder rather than breaking the page; it deliberately does
    // NOT fall back to `downloadFile`, which would turn browsing a folder of a
    // few hundred photos into downloading a few hundred full-resolution
    // originals just to draw thumbnails.
    try {
      const metadata = await apiGet<{ thumbnailLink?: string }>(
        `/files/${encodeURIComponent(fileId)}`,
        { fields: 'thumbnailLink' },
      );
      if (!metadata.thumbnailLink) return null;

      const token = await accessToken();
      const response = await fetch(metadata.thumbnailLink, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return null;

      const bytes = new Uint8Array(await response.arrayBuffer());
      const mimeType = response.headers.get('content-type') ?? 'image/jpeg';
      return { bytes, mimeType };
    } catch {
      return null;
    }
  }
}

export function createGoogleDriveSource(): DriveSource {
  return new GoogleDriveSource();
}
