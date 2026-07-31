/**
 * Drift check: hand-written types vs the live database schema.
 *
 * `apps/web/src/lib/db.types.ts` is maintained by hand because the Supabase
 * generator cannot infer union literals from CHECK constraints — it emits
 * `status: string` where the hand-written file has the actual six-value union.
 * Keeping the hand-written version buys real type safety, at the cost of it
 * being able to drift from the schema silently. This script closes that gap.
 *
 * Compares every table and Row column in the generated snapshot (authoritative,
 * read from the live database) against the hand-written file, including
 * nullability. Union-vs-string differences are expected and ignored.
 *
 * Usage:
 *   supabase gen types typescript --linked > supabase/types.generated.ts
 *   node scripts/check-db-types.mjs
 *
 * Exits non-zero on any discrepancy, so it can gate CI.
 */
import { readFileSync } from 'node:fs';

const HAND = 'apps/web/src/lib/db.types.ts';
const GENERATED = 'supabase/types.generated.ts';

/** Extract { table -> { column -> isNullable } } from a schema's Row blocks. */
function parse(source) {
  const tables = {};

  // Anchor on line start and exact indent: a bare indexOf('public: {') also
  // matches inside 'graphql_public: {'.
  const schemaMatch = /^ {2}public: \{$/m.exec(source);
  const schemaStart = schemaMatch ? schemaMatch.index : 0;
  const tablesStart = source.indexOf('Tables: {', schemaStart);
  const viewsStart = source.indexOf('Views:', tablesStart);
  const section = source.slice(tablesStart, viewsStart === -1 ? undefined : viewsStart);

  const marks = [];
  const tableRe = /^ {6}(\w+): \{$/gm;
  let m;
  while ((m = tableRe.exec(section))) marks.push({ name: m[1], at: m.index });

  for (let i = 0; i < marks.length; i++) {
    const body = section.slice(marks[i].at, marks[i + 1]?.at ?? section.length);
    const rowStart = body.indexOf('Row: {');
    if (rowStart === -1) continue;
    const insertStart = body.indexOf('Insert:', rowStart);
    const rowBody = body.slice(rowStart, insertStart === -1 ? undefined : insertStart);

    const cols = {};
    const lines = rowBody.split('\n');

    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];

      // Single-line column: `name: type`
      const single = line.match(/^ {10}(\w+)\??:\s*(\S.*?);?\s*$/);
      if (single && !['Row', 'Insert', 'Update', 'Relationships'].includes(single[1])) {
        cols[single[1]] = /\|\s*null/.test(single[2]);
        continue;
      }

      // Multi-line union: `name:` followed by indented `| 'a'` continuation
      // lines. The hand-written file formats long unions this way.
      const multi = line.match(/^ {10}(\w+)\??:\s*$/);
      if (multi) {
        let type = '';
        for (let k = j + 1; k < lines.length; k++) {
          if (!/^ {12}\|/.test(lines[k])) break;
          type += lines[k];
        }
        cols[multi[1]] = /\|\s*null/.test(type);
      }
    }

    if (Object.keys(cols).length) tables[marks[i].name] = cols;
  }

  return tables;
}

const hand = parse(readFileSync(HAND, 'utf8'));
const gen = parse(readFileSync(GENERATED, 'utf8'));

if (Object.keys(gen).length === 0) {
  console.error(
    `No tables parsed from ${GENERATED}. Regenerate it first:\n` +
      '  supabase gen types typescript --linked > supabase/types.generated.ts',
  );
  process.exit(1);
}

const problems = [];

for (const [table, cols] of Object.entries(gen)) {
  if (!hand[table]) {
    problems.push(`MISSING TABLE: ${table} is in the database but not in db.types.ts`);
    continue;
  }
  for (const [col, nullable] of Object.entries(cols)) {
    if (!(col in hand[table])) {
      problems.push(`MISSING COLUMN: ${table}.${col}`);
    } else if (hand[table][col] !== nullable) {
      problems.push(
        `NULLABILITY: ${table}.${col} — database says ${
          nullable ? 'nullable' : 'not null'
        }, db.types.ts says ${hand[table][col] ? 'nullable' : 'not null'}`,
      );
    }
  }
  for (const col of Object.keys(hand[table])) {
    if (!(col in cols)) {
      problems.push(
        `STALE COLUMN: ${table}.${col} is in db.types.ts but not the database`,
      );
    }
  }
}

for (const table of Object.keys(hand)) {
  if (!gen[table]) {
    problems.push(`STALE TABLE: ${table} is in db.types.ts but not the database`);
  }
}

const columnCount = Object.values(gen).reduce((n, c) => n + Object.keys(c).length, 0);
console.log(`Compared ${Object.keys(gen).length} tables, ${columnCount} columns.`);

if (problems.length) {
  console.error(`\n${problems.length} discrepancies:\n` + problems.join('\n'));
  process.exit(1);
}

console.log('db.types.ts matches the live schema.');
