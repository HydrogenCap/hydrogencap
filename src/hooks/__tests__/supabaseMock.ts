/**
 * Shared Supabase client mock for V2 hook tests.
 *
 * Returns a chainable builder that records the operation (`select`/`insert`/
 * `update`/`delete`), filters, payload, and terminal kind (`single`/
 * `maybeSingle`), then hands them to the caller-provided `handler` which
 * returns `{ data, error, count? }` just like the real client.
 *
 * Designed for regression coverage of the V2 hooks ahead of V1/V2
 * consolidation — callers stub just enough shape to let the hook finish,
 * then assert on the returned data + on the recorded calls.
 */
import { vi } from 'vitest';

export type QueryOp = 'select' | 'insert' | 'update' | 'delete' | 'upsert';

export interface QueryState {
  table: string;
  op: QueryOp;
  columns?: string;
  payload?: unknown;
  filters: Record<string, unknown>;
  single: boolean;
  maybeSingle: boolean;
}

export type QueryResult<T = unknown> = {
  data: T | null;
  error: { message: string } | null;
  count?: number;
};

export type QueryHandler = (state: QueryState) => QueryResult | Promise<QueryResult>;

export interface MockSupabase {
  from: ReturnType<typeof vi.fn>;
  auth: {
    getUser: ReturnType<typeof vi.fn>;
    getSession: ReturnType<typeof vi.fn>;
  };
  rpc: ReturnType<typeof vi.fn>;
  functions: {
    invoke: ReturnType<typeof vi.fn>;
  };
  storage: {
    from: ReturnType<typeof vi.fn>;
  };
  __calls: QueryState[];
  __lastCall: () => QueryState | undefined;
}

export function createMockSupabase(handler: QueryHandler): MockSupabase {
  const calls: QueryState[] = [];

  function buildQuery(initial: Pick<QueryState, 'table' | 'op' | 'columns' | 'payload'>) {
    const state: QueryState = {
      ...initial,
      filters: {},
      single: false,
      maybeSingle: false,
    };

    const run = () => {
      calls.push({ ...state, filters: { ...state.filters } });
      return Promise.resolve(handler(state));
    };

    const builder: Record<string, unknown> = {
      eq: (k: string, v: unknown) => ((state.filters[k] = { eq: v }), builder),
      neq: (k: string, v: unknown) => ((state.filters[k] = { neq: v }), builder),
      in: (k: string, v: unknown[]) => ((state.filters[k] = { in: v }), builder),
      is: (k: string, v: unknown) => ((state.filters[k] = { is: v }), builder),
      gt: (k: string, v: unknown) => ((state.filters[k] = { gt: v }), builder),
      lt: (k: string, v: unknown) => ((state.filters[k] = { lt: v }), builder),
      gte: (k: string, v: unknown) => ((state.filters[k] = { gte: v }), builder),
      lte: (k: string, v: unknown) => ((state.filters[k] = { lte: v }), builder),
      or: (expr: string) => ((state.filters.__or = expr), builder),
      order: () => builder,
      range: () => builder,
      limit: () => builder,
      // `.select()` on an insert/update/delete is a return-representation
      // modifier — it MUST NOT overwrite `op`.
      select: (cols?: string) => {
        state.columns = cols ?? state.columns;
        return builder;
      },
      single: () => ((state.single = true), builder),
      maybeSingle: () => ((state.maybeSingle = true), builder),
      then: (resolve: (v: QueryResult) => unknown, reject?: (e: unknown) => unknown) =>
        run().then(resolve, reject),
      catch: (reject: (e: unknown) => unknown) => run().catch(reject),
    };

    return builder;
  }

  const fromFn = vi.fn((table: string) => ({
    select: (cols?: string) => buildQuery({ table, op: 'select', columns: cols }),
    insert: (payload: unknown) => buildQuery({ table, op: 'insert', payload }),
    update: (payload: unknown) => buildQuery({ table, op: 'update', payload }),
    delete: () => buildQuery({ table, op: 'delete' }),
    upsert: (payload: unknown) => buildQuery({ table, op: 'upsert', payload }),
  }));

  const getUser = vi.fn(async () => ({
    data: { user: { id: 'user-1', email: 'test@tenureiq.com' } },
    error: null,
  }));
  const getSession = vi.fn(async () => ({
    data: { session: { access_token: 'token' } },
    error: null,
  }));

  const rpc = vi.fn(async () => ({ data: null, error: null }));

  const invoke = vi.fn(async () => ({ data: {}, error: null }));

  const storageFrom = vi.fn(() => ({
    createSignedUrls: async (paths: string[]) => ({
      data: paths.map((p) => ({ path: p, signedUrl: `https://signed.test/${p}` })),
      error: null,
    }),
    createSignedUrl: async (path: string) => ({
      data: { signedUrl: `https://signed.test/${path}` },
      error: null,
    }),
    upload: vi.fn(async () => ({ data: { path: 'uploaded' }, error: null })),
    remove: vi.fn(async () => ({ data: null, error: null })),
  }));

  return {
    from: fromFn,
    auth: { getUser, getSession },
    rpc,
    functions: { invoke },
    storage: { from: storageFrom },
    __calls: calls,
    __lastCall: () => calls[calls.length - 1],
  };
}
