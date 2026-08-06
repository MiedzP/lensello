import { describe, expect, it } from 'vitest';
import { describeSchemaError, friendlyDbError } from './schema-errors';

describe('describeSchemaError', () => {
  it('recognises a missing table by code', () => {
    expect(describeSchemaError({ code: '42P01', message: 'relation "galleries" does not exist' }))
      .toContain('database tables have not been created');
  });

  it('recognises a missing column by code', () => {
    expect(describeSchemaError({ code: '42703', message: 'column x does not exist' })).not.toBeNull();
  });

  it('recognises it by message when the code is absent', () => {
    // Some client layers surface the message without the code.
    expect(
      describeSchemaError({ message: 'relation "contracts" does not exist' }),
    ).not.toBeNull();
  });

  it('leaves unrelated errors alone', () => {
    // A unique violation is a real problem with what the user did, and dressing
    // it up as a pending migration would send them to fix the wrong thing.
    expect(
      describeSchemaError({ code: '23505', message: 'duplicate key value' }),
    ).toBeNull();
    expect(describeSchemaError({ code: '23503', message: 'foreign key violation' })).toBeNull();
    expect(describeSchemaError(null)).toBeNull();
  });
});

describe('friendlyDbError', () => {
  it('explains a schema gap', () => {
    expect(friendlyDbError({ code: '42P01' }, 'fallback')).toContain('supabase/migrations');
  });

  it('passes through a real database message', () => {
    expect(friendlyDbError({ code: '23505', message: 'duplicate key' }, 'fallback')).toBe(
      'duplicate key',
    );
  });

  it('uses the fallback when there is nothing to report', () => {
    expect(friendlyDbError(null, 'fallback')).toBe('fallback');
    expect(friendlyDbError({}, 'fallback')).toBe('fallback');
  });
});
