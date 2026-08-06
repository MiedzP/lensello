/**
 * Turning a missing-schema error into something actionable.
 *
 * Code ships ahead of migrations — the deploy is one command, the SQL needs
 * somebody with database credentials — so there is always a window where a
 * feature exists in the app and its tables do not. In that window the raw
 * message is `relation "galleries" does not exist`, which reads as "the app is
 * broken" rather than "one step is outstanding".
 *
 * This is not an apology for the gap. It makes the gap legible so the person
 * looking at it knows it is a pending migration and not a bug in the feature.
 */

/** Postgres: undefined_table and undefined_column. */
const UNDEFINED_TABLE = '42P01';
const UNDEFINED_COLUMN = '42703';

interface MaybePostgresError {
  code?: string | null;
  message?: string | null;
}

/**
 * A clear explanation when the schema is behind the code, or null when the
 * error is something else and the caller should report it as it is.
 */
export function describeSchemaError(error: MaybePostgresError | null): string | null {
  if (!error) return null;

  const code = error.code ?? '';
  const message = error.message ?? '';

  const missingSchema =
    code === UNDEFINED_TABLE ||
    code === UNDEFINED_COLUMN ||
    /relation ".*" does not exist|column ".*" does not exist/.test(message);

  if (!missingSchema) return null;

  return (
    'This feature is deployed but its database tables have not been created ' +
    'yet. Run the outstanding files in supabase/migrations against the ' +
    'Supabase project — one at a time — and it will work immediately, with no ' +
    'redeploy needed.'
  );
}

/** `describeSchemaError`, falling back to the raw message. */
export function friendlyDbError(
  error: MaybePostgresError | null,
  fallback: string,
): string {
  return describeSchemaError(error) ?? error?.message ?? fallback;
}
