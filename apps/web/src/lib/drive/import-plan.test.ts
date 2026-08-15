import { describe, expect, it } from 'vitest';
import {
  buildImportShootNotes,
  buildImportShootTitle,
  buildImportStoragePath,
  deriveFolderTag,
  nextJobStatus,
  selectFilesToProcess,
  selectNewFileIds,
  summarizeCounts,
} from './import-plan';

describe('buildImportStoragePath', () => {
  it('is deterministic — the same file always lands at the same path', () => {
    const a = buildImportStoragePath('shoot1', 'file123', 'IMG_0001.JPG');
    const b = buildImportStoragePath('shoot1', 'file123', 'IMG_0001.JPG');
    expect(a).toBe(b);
  });

  it('differs when the shoot or the file differs, so folders never collide', () => {
    const base = buildImportStoragePath('shoot1', 'file123', 'a.jpg');
    expect(buildImportStoragePath('shoot2', 'file123', 'a.jpg')).not.toBe(base);
    expect(buildImportStoragePath('shoot1', 'file456', 'a.jpg')).not.toBe(base);
  });

  it('sits under the shoot prefix and carries the Drive id, so the path is self-describing', () => {
    const path = buildImportStoragePath('shoot1', 'file123', 'speech.jpg');
    expect(path).toBe('shoots/shoot1/drive-file123-speech.jpg');
  });

  it('sanitises a hostile filename rather than embedding it raw', () => {
    const path = buildImportStoragePath('shoot1', 'file123', '../../etc/passwd');
    expect(path.startsWith('shoots/shoot1/drive-file123-')).toBe(true);
    expect(path).not.toContain('..');
    expect(path).not.toContain('/etc/');
  });
});

describe('selectNewFileIds', () => {
  it('drops ids already tracked for the job — re-selecting a folder is a no-op', () => {
    const tracked = new Set(['a', 'b']);
    expect(selectNewFileIds(tracked, ['a', 'b', 'c'])).toEqual(['c']);
  });

  it('de-duplicates the request itself', () => {
    expect(selectNewFileIds(new Set(), ['a', 'a', 'b'])).toEqual(['a', 'b']);
  });

  it('returns everything when nothing is tracked yet', () => {
    expect(selectNewFileIds(new Set(), ['a', 'b'])).toEqual(['a', 'b']);
  });

  it('returns nothing when everything requested is already tracked', () => {
    expect(selectNewFileIds(new Set(['a', 'b']), ['a', 'b'])).toEqual([]);
  });
});

describe('selectFilesToProcess', () => {
  const file = (id: string, status: 'pending' | 'imported' | 'failed', attempts = 0) => ({
    driveFileId: id,
    status,
    attempts,
  });

  it('never re-selects an already-imported file — the idempotency guarantee', () => {
    const files = [file('a', 'imported'), file('b', 'pending')];
    expect(selectFilesToProcess(files, 10).map((f) => f.driveFileId)).toEqual(['b']);
  });

  it('picks up pending and failed files — the resume guarantee', () => {
    const files = [file('a', 'pending'), file('b', 'failed', 1), file('c', 'imported')];
    expect(selectFilesToProcess(files, 10).map((f) => f.driveFileId)).toEqual(['a', 'b']);
  });

  it('stops retrying a file once it has exhausted the attempt cap', () => {
    const files = [file('a', 'failed', 5)];
    expect(selectFilesToProcess(files, 10, 5)).toEqual([]);
    expect(selectFilesToProcess([file('a', 'failed', 4)], 10, 5)).toHaveLength(1);
  });

  it('caps the batch at the given limit, in order', () => {
    const files = [file('a', 'pending'), file('b', 'pending'), file('c', 'pending')];
    expect(selectFilesToProcess(files, 2).map((f) => f.driveFileId)).toEqual(['a', 'b']);
  });

  it('calling it again with an unchanged list picks up exactly where the last batch left off', () => {
    // Simulates a resumed run: the first batch imported "a", so the caller's
    // next read of the table already reflects that before the next call.
    const afterFirstBatch = [file('a', 'imported'), file('b', 'pending'), file('c', 'pending')];
    expect(selectFilesToProcess(afterFirstBatch, 1).map((f) => f.driveFileId)).toEqual(['b']);
  });
});

describe('summarizeCounts', () => {
  it('counts every status', () => {
    const files = [{ status: 'imported' as const }, { status: 'failed' as const }, { status: 'pending' as const }, { status: 'imported' as const }];
    expect(summarizeCounts(files)).toEqual({ total: 4, imported: 2, failed: 1, pending: 1 });
  });

  it('is empty for no files', () => {
    expect(summarizeCounts([])).toEqual({ total: 0, imported: 0, failed: 0, pending: 0 });
  });
});

describe('nextJobStatus', () => {
  it('is pending for a job with no files yet', () => {
    expect(nextJobStatus({ total: 0, imported: 0, failed: 0, pending: 0 }, false)).toBe('pending');
  });

  it('is running while any file is still pending', () => {
    expect(nextJobStatus({ total: 3, imported: 1, failed: 0, pending: 2 }, false)).toBe('running');
  });

  it('is running while a failed file still has retries available', () => {
    expect(nextJobStatus({ total: 3, imported: 2, failed: 1, pending: 0 }, true)).toBe('running');
  });

  it('is completed once every file imported', () => {
    expect(nextJobStatus({ total: 3, imported: 3, failed: 0, pending: 0 }, false)).toBe('completed');
  });

  it('is completed_with_errors once nothing pending remains and no failure can retry further', () => {
    expect(nextJobStatus({ total: 3, imported: 2, failed: 1, pending: 0 }, false)).toBe(
      'completed_with_errors',
    );
  });
});

describe('buildImportShootTitle', () => {
  it('prefixes the folder name so it reads as imported wherever shoots are listed', () => {
    expect(buildImportShootTitle('Family Album — Beach Day')).toBe(
      'Imported — Family Album — Beach Day',
    );
  });

  it('falls back to a placeholder for a blank folder name', () => {
    expect(buildImportShootTitle('   ')).toBe('Imported — Untitled Drive folder');
  });
});

describe('buildImportShootNotes', () => {
  it('names the source folder and states this is not client work', () => {
    const notes = buildImportShootNotes('folder123', 'Family Album');
    expect(notes).toContain('folder123');
    expect(notes).toContain('Family Album');
    expect(notes.toLowerCase()).toContain('not a client shoot');
  });
});

describe('deriveFolderTag', () => {
  it('lower-cases and hyphenates so it matches how tags are typed elsewhere', () => {
    expect(deriveFolderTag('In-house — Wedding Speeches')).toBe('in-house-wedding-speeches');
  });

  it('never returns an empty tag, even for a name with no usable characters', () => {
    expect(deriveFolderTag('   ')).toBe('drive-import');
    expect(deriveFolderTag('★★★')).toBe('drive-import');
  });
});
