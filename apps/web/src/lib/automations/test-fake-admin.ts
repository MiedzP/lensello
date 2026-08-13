/**
 * A minimal in-memory stand-in for the Supabase admin client, used only by
 * this module's own tests.
 *
 * Not a general-purpose Supabase mock — it implements exactly the chain of
 * calls `runner.ts`, `rate-limit.ts`, `context.ts`, and `dispatch.ts` make
 * (`select`/`eq`/`in`/`gte`/`lte`/`contains`/`is`/`order`/`limit`, `insert`,
 * `update`, `delete`, `maybeSingle`/`single`, and plain `await`), against a
 * plain object of arrays. Good enough to exercise the runner's control flow
 * — ordering, `continue_on_error`, the rate limit, the loop guard — without a
 * database, and nothing more.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface FakeStore {
  tables: Record<string, any[]>;
}

export function createFakeStore(): FakeStore {
  return { tables: {} };
}

function tableOf(store: FakeStore, name: string): any[] {
  if (!store.tables[name]) store.tables[name] = [];
  return store.tables[name];
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `fake-${idCounter}`;
}

class FakeQuery implements PromiseLike<{ data: any; error: any; count?: number }> {
  private filters: Array<(row: any) => boolean> = [];
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private insertRows: any[] | null = null;
  private updatePatch: any = null;
  private orderKey: string | null = null;
  private orderAscending = true;
  private limitN: number | null = null;
  private wantCount = false;

  constructor(
    private readonly store: FakeStore,
    private readonly table: string,
  ) {}

  select(_columns?: string, opts?: { count?: 'exact'; head?: boolean }): this {
    if (opts?.count) this.wantCount = true;
    return this;
  }

  eq(key: string, value: unknown): this {
    this.filters.push((row) => row[key] === value);
    return this;
  }

  in(key: string, values: unknown[]): this {
    this.filters.push((row) => values.includes(row[key]));
    return this;
  }

  gte(key: string, value: string): this {
    this.filters.push((row) => row[key] >= value);
    return this;
  }

  lte(key: string, value: string): this {
    this.filters.push((row) => row[key] <= value);
    return this;
  }

  lt(key: string, value: string): this {
    this.filters.push((row) => row[key] < value);
    return this;
  }

  is(key: string, value: unknown): this {
    this.filters.push((row) => (value === null ? row[key] == null : row[key] === value));
    return this;
  }

  contains(key: string, value: Record<string, unknown>): this {
    this.filters.push((row) =>
      Object.entries(value).every(([nestedKey, nestedValue]) => (row[key] ?? {})[nestedKey] === nestedValue),
    );
    return this;
  }

  order(key: string, opts?: { ascending?: boolean }): this {
    this.orderKey = key;
    this.orderAscending = opts?.ascending ?? true;
    return this;
  }

  limit(n: number): this {
    this.limitN = n;
    return this;
  }

  insert(rows: any): this {
    this.op = 'insert';
    this.insertRows = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  update(patch: any): this {
    this.op = 'update';
    this.updatePatch = patch;
    return this;
  }

  delete(): this {
    this.op = 'delete';
    return this;
  }

  private matched(): any[] {
    return tableOf(this.store, this.table).filter((row) => this.filters.every((f) => f(row)));
  }

  private execute(): { data: any; error: any; count?: number } {
    if (this.op === 'insert') {
      const created = (this.insertRows ?? []).map((row) => ({
        id: nextId(),
        created_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        ...row,
      }));
      tableOf(this.store, this.table).push(...created);
      return { data: created, error: null };
    }

    if (this.op === 'update') {
      const rows = this.matched();
      rows.forEach((row) => Object.assign(row, this.updatePatch));
      return { data: rows, error: null };
    }

    if (this.op === 'delete') {
      const remaining = tableOf(this.store, this.table).filter((row) => !this.filters.every((f) => f(row)));
      this.store.tables[this.table] = remaining;
      return { data: null, error: null };
    }

    let rows = this.matched();
    if (this.orderKey) {
      const key = this.orderKey;
      rows = [...rows].sort((a, b) => {
        if (a[key] === b[key]) return 0;
        return (a[key] > b[key] ? 1 : -1) * (this.orderAscending ? 1 : -1);
      });
    }
    if (this.limitN !== null) rows = rows.slice(0, this.limitN);

    return { data: rows, error: null, count: rows.length };
  }

  maybeSingle(): Promise<{ data: any; error: any }> {
    const { data, error } = this.execute();
    const rows = (data ?? []) as any[];
    return Promise.resolve({ data: rows[0] ?? null, error });
  }

  single(): Promise<{ data: any; error: any }> {
    const { data, error } = this.execute();
    const rows = (data ?? []) as any[];
    if (rows.length === 0) {
      return Promise.resolve({ data: null, error: error ?? { message: 'No rows found.' } });
    }
    return Promise.resolve({ data: rows[0], error: null });
  }

  then<TResult1, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

export function createFakeAdmin(store: FakeStore) {
  return {
    from(table: string) {
      return new FakeQuery(store, table);
    },
  } as any;
}
