/**
 * End-to-end idempotency and resume behaviour of the import engine itself,
 * not just the pure decisions in `import-plan.test.ts`.
 *
 * Runs against a small in-memory stand-in for the two tables this module
 * touches (`drive_import_jobs`, `drive_import_files`) plus `shoots` /
 * `assets` and a fake Storage bucket — not a real Supabase client, but a
 * faithful enough slice of its query builder to exercise the actual
 * `ensureImportJob` / `addFilesToJob` / `runImportBatch` functions, including
 * the conditional updates and upsert-based dedup that give the real database
 * its guarantees. `getDriveSource()` is mocked so a file's download can be
 * made to fail on demand, which is what the resume test needs.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { driveMock } = vi.hoisted(() => ({
  driveMock: {
    listImages: vi.fn(),
    downloadFile: vi.fn(),
  },
}));

vi.mock('@lensello/core/integrations', () => ({
  getDriveSource: () => driveMock,
}));

import { addFilesToJob, ensureImportJob, runImportBatch } from './import-run';

// --- a tiny in-memory stand-in for the slice of supabase-js this module uses ---

interface Row {
  [key: string]: unknown;
}

let nextId = 0;
function freshId(): string {
  nextId += 1;
  return `id-${nextId}`;
}

/**
 * Mirrors the column defaults `20260813140000_drive_import.sql` gives
 * Postgres — the fake has no schema of its own, so without this a row
 * created without an explicit `status` would come back `undefined` instead
 * of `'pending'`, and every "is this file still pending?" check downstream
 * would silently see nothing.
 */
function defaultsFor(table: string): Row {
  if (table === 'drive_import_jobs') {
    return { status: 'pending', total_files: 0, imported_files: 0, failed_files: 0 };
  }
  if (table === 'drive_import_files') {
    return { status: 'pending', attempts: 0, error: null, asset_id: null };
  }
  return {};
}

class FakeSupabase {
  tables = new Map<string, Row[]>();
  storageObjects = new Map<string, { bytes: Uint8Array; contentType: string }>();

  table(name: string): Row[] {
    if (!this.tables.has(name)) this.tables.set(name, []);
    return this.tables.get(name)!;
  }

  from(name: string) {
    return new FakeQuery(this, name);
  }

  storage = {
    from: () => ({
      upload: async (
        path: string,
        bytes: Uint8Array,
        opts: { contentType: string },
      ) => {
        this.storageObjects.set(path, { bytes, contentType: opts.contentType });
        return { data: { path }, error: null };
      },
    }),
  };
}

type Terminal = 'none' | 'maybeSingle' | 'single';

class FakeQuery implements PromiseLike<{ data: unknown; error: unknown; count?: number }> {
  private op: 'select' | 'insert' | 'update' | 'upsert' = 'select';
  private predicates: Array<(row: Row) => boolean> = [];
  private payload: Row[] = [];
  private upsertOpts: { onConflict?: string; ignoreDuplicates?: boolean } = {};
  private wantCount = false;
  private terminal: Terminal = 'none';

  constructor(
    private readonly db: FakeSupabase,
    private readonly tableName: string,
  ) {}

  select(_cols?: string, opts?: { count?: 'exact'; head?: boolean }) {
    if (opts?.count) this.wantCount = true;
    return this;
  }
  eq(col: string, val: unknown) {
    this.predicates.push((row) => row[col] === val);
    return this;
  }
  in(col: string, vals: readonly unknown[]) {
    this.predicates.push((row) => vals.includes(row[col]));
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  insert(obj: Row | Row[]) {
    this.op = 'insert';
    this.payload = Array.isArray(obj) ? obj : [obj];
    return this;
  }
  update(obj: Row) {
    this.op = 'update';
    this.payload = [obj];
    return this;
  }
  upsert(obj: Row | Row[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.op = 'upsert';
    this.payload = Array.isArray(obj) ? obj : [obj];
    this.upsertOpts = opts ?? {};
    return this;
  }
  maybeSingle() {
    this.terminal = 'maybeSingle';
    return this.exec();
  }
  single() {
    this.terminal = 'single';
    return this.exec();
  }
  then<TResult1, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.exec().then(onfulfilled, onrejected);
  }

  private matched(): Row[] {
    return this.db.table(this.tableName).filter((row) => this.predicates.every((p) => p(row)));
  }

  private async exec(): Promise<{ data: unknown; error: unknown; count?: number }> {
    const rows = this.db.table(this.tableName);
    const now = new Date().toISOString();

    if (this.op === 'select') {
      const matched = this.matched();
      if (this.wantCount) return { data: null, error: null, count: matched.length };
      if (this.terminal === 'maybeSingle') return { data: matched[0] ?? null, error: null };
      if (this.terminal === 'single') {
        return matched[0] ? { data: matched[0], error: null } : { data: null, error: { message: 'no rows found' } };
      }
      return { data: matched, error: null };
    }

    if (this.op === 'insert') {
      const inserted: Row[] = [];
      for (const raw of this.payload) {
        if (
          this.tableName === 'drive_import_jobs' &&
          rows.some((r) => r.drive_folder_id === raw.drive_folder_id)
        ) {
          return { data: null, error: { message: 'duplicate key value violates unique constraint' } };
        }
        const row: Row = { ...defaultsFor(this.tableName), id: freshId(), created_at: now, updated_at: now, ...raw };
        rows.push(row);
        inserted.push(row);
      }
      if (this.terminal === 'single' || this.terminal === 'maybeSingle') {
        return { data: inserted[0] ?? null, error: null };
      }
      return { data: inserted, error: null };
    }

    if (this.op === 'update') {
      const matched = this.matched();
      for (const row of matched) Object.assign(row, this.payload[0], { updated_at: now });
      if (this.terminal === 'single') {
        return matched[0] ? { data: matched[0], error: null } : { data: null, error: { message: 'no rows found' } };
      }
      if (this.terminal === 'maybeSingle') return { data: matched[0] ?? null, error: null };
      return { data: matched, error: null };
    }

    if (this.op === 'upsert') {
      const keyCols = (this.upsertOpts.onConflict ?? 'id').split(',');
      const results: Row[] = [];
      for (const raw of this.payload) {
        const existing = rows.find((row) => keyCols.every((col) => row[col] === raw[col]));
        if (existing) {
          if (!this.upsertOpts.ignoreDuplicates) Object.assign(existing, raw, { updated_at: now });
          results.push(existing);
        } else {
          const row: Row = { ...defaultsFor(this.tableName), id: freshId(), created_at: now, updated_at: now, ...raw };
          rows.push(row);
          results.push(row);
        }
      }
      if (this.terminal === 'single' || this.terminal === 'maybeSingle') {
        return { data: results[0] ?? null, error: null };
      }
      return { data: results, error: null };
    }

    return { data: null, error: { message: `unsupported op ${this.op}` } };
  }
}

// --- fixtures -------------------------------------------------------------

const FOLDER_ID = 'folder_xyz';
const FOLDER_NAME = 'In-house — Wedding Speeches';

const IMAGE_A = {
  id: 'file_a',
  name: 'a.jpg',
  mimeType: 'image/jpeg',
  byteSize: 100,
  width: 800,
  height: 600,
  modifiedTime: '2026-07-01T00:00:00Z',
};
const IMAGE_B = {
  id: 'file_b',
  name: 'b.jpg',
  mimeType: 'image/jpeg',
  byteSize: 200,
  width: 800,
  height: 600,
  modifiedTime: '2026-07-01T00:00:00Z',
};

function makeDb() {
  return new FakeSupabase() as unknown as Parameters<typeof ensureImportJob>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  driveMock.listImages.mockResolvedValue([IMAGE_A, IMAGE_B]);
  driveMock.downloadFile.mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg' });
});

describe('ensureImportJob', () => {
  it('creates exactly one job and one shoot for a folder, however many times it is called', async () => {
    const db = makeDb();

    const first = await ensureImportJob(db, {
      driveFolderId: FOLDER_ID,
      driveFolderName: FOLDER_NAME,
      createdBy: 'user-1',
    });
    const second = await ensureImportJob(db, {
      driveFolderId: FOLDER_ID,
      driveFolderName: FOLDER_NAME,
      createdBy: 'user-1',
    });

    expect(first.createdShoot).toBe(true);
    expect(second.createdShoot).toBe(false);
    expect(second.job.id).toBe(first.job.id);
    expect(second.job.shootId).toBe(first.job.shootId);

    const fake = db as unknown as FakeSupabase;
    expect(fake.table('drive_import_jobs')).toHaveLength(1);
    expect(fake.table('shoots')).toHaveLength(1);
  });
});

describe('addFilesToJob', () => {
  it('tracks each file once, even when the same selection is submitted twice', async () => {
    const db = makeDb();
    const { job } = await ensureImportJob(db, {
      driveFolderId: FOLDER_ID,
      driveFolderName: FOLDER_NAME,
      createdBy: 'user-1',
    });

    const first = await addFilesToJob(db, {
      jobId: job.id,
      driveFolderId: FOLDER_ID,
      fileIds: ['file_a', 'file_b'],
    });
    const second = await addFilesToJob(db, {
      jobId: job.id,
      driveFolderId: FOLDER_ID,
      fileIds: ['file_a', 'file_b'],
    });

    expect(first.added).toBe(2);
    expect(second.added).toBe(0);
    expect(first.job.totalFiles).toBe(2);
    expect(second.job.totalFiles).toBe(2);

    const fake = db as unknown as FakeSupabase;
    expect(fake.table('drive_import_files')).toHaveLength(2);
  });

  it('is additive: selecting one more file from the same folder tracks only the new one', async () => {
    const db = makeDb();
    const { job } = await ensureImportJob(db, {
      driveFolderId: FOLDER_ID,
      driveFolderName: FOLDER_NAME,
      createdBy: 'user-1',
    });

    await addFilesToJob(db, { jobId: job.id, driveFolderId: FOLDER_ID, fileIds: ['file_a'] });
    const second = await addFilesToJob(db, {
      jobId: job.id,
      driveFolderId: FOLDER_ID,
      fileIds: ['file_a', 'file_b'],
    });

    expect(second.added).toBe(1);
    expect(second.job.totalFiles).toBe(2);
  });
});

describe('runImportBatch', () => {
  it('imports every file, and a repeat run is a no-op — the idempotency guarantee', async () => {
    const db = makeDb();
    const { job } = await ensureImportJob(db, {
      driveFolderId: FOLDER_ID,
      driveFolderName: FOLDER_NAME,
      createdBy: 'user-1',
    });
    await addFilesToJob(db, { jobId: job.id, driveFolderId: FOLDER_ID, fileIds: ['file_a', 'file_b'] });

    const firstRun = await runImportBatch(db, { jobId: job.id });
    expect(firstRun.imported).toBe(2);
    expect(firstRun.job.status).toBe('completed');
    expect(firstRun.done).toBe(true);

    const fake = db as unknown as FakeSupabase;
    expect(fake.table('assets')).toHaveLength(2);

    // Calling it again finds nothing left to attempt: no duplicate assets,
    // no duplicate tracking rows, no change in outcome.
    const secondRun = await runImportBatch(db, { jobId: job.id });
    expect(secondRun.processed).toBe(0);
    expect(secondRun.imported).toBe(0);
    expect(fake.table('assets')).toHaveLength(2);
    expect(fake.table('drive_import_files')).toHaveLength(2);
  });

  it('resumes after a failure: the file that succeeded is never retried, the one that failed is retried and completes', async () => {
    const db = makeDb();
    const { job } = await ensureImportJob(db, {
      driveFolderId: FOLDER_ID,
      driveFolderName: FOLDER_NAME,
      createdBy: 'user-1',
    });
    await addFilesToJob(db, { jobId: job.id, driveFolderId: FOLDER_ID, fileIds: ['file_a', 'file_b'] });

    // file_b's download fails once, as if the connection dropped mid-batch.
    driveMock.downloadFile.mockImplementation(async (fileId: string) => {
      if (fileId === 'file_b') throw new Error('network dropped');
      return { bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg' };
    });

    const firstRun = await runImportBatch(db, { jobId: job.id });
    expect(firstRun.imported).toBe(1);
    expect(firstRun.failed).toBe(1);
    expect(firstRun.done).toBe(false);
    expect(firstRun.job.status).toBe('running');

    const fake = db as unknown as FakeSupabase;
    expect(fake.table('assets')).toHaveLength(1);
    const fileB = fake.table('drive_import_files').find((row) => row.drive_file_id === 'file_b')!;
    expect(fileB.status).toBe('failed');
    expect(fileB.attempts).toBe(1);

    // The transient fault clears; resuming (same job, no new selection) picks
    // up exactly the file that did not succeed.
    driveMock.downloadFile.mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg' });

    const secondRun = await runImportBatch(db, { jobId: job.id });
    expect(secondRun.processed).toBe(1);
    expect(secondRun.imported).toBe(1);
    expect(secondRun.done).toBe(true);
    expect(secondRun.job.status).toBe('completed');

    // Still exactly two files tracked and two assets created — resuming did
    // not duplicate the file that had already succeeded.
    expect(fake.table('drive_import_files')).toHaveLength(2);
    expect(fake.table('assets')).toHaveLength(2);
  });

  it('stops retrying a file once it has exhausted the attempt cap', async () => {
    const db = makeDb();
    const { job } = await ensureImportJob(db, {
      driveFolderId: FOLDER_ID,
      driveFolderName: FOLDER_NAME,
      createdBy: 'user-1',
    });
    await addFilesToJob(db, { jobId: job.id, driveFolderId: FOLDER_ID, fileIds: ['file_a'] });

    driveMock.downloadFile.mockRejectedValue(new Error('permanently broken'));

    let last = await runImportBatch(db, { jobId: job.id });
    for (let i = 0; i < 5; i++) {
      last = await runImportBatch(db, { jobId: job.id });
    }

    expect(last.job.status).toBe('completed_with_errors');

    const fake = db as unknown as FakeSupabase;
    const fileA = fake.table('drive_import_files')[0]!;
    expect(fileA.attempts).toBeLessThanOrEqual(5);

    // One more call makes no further attempt — the file is done retrying.
    const attemptsBefore = fileA.attempts;
    const extra = await runImportBatch(db, { jobId: job.id });
    expect(extra.processed).toBe(0);
    expect(fileA.attempts).toBe(attemptsBefore);
  });
});
