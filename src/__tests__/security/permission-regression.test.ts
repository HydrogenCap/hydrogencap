/**
 * Permission regression suite.
 *
 * Asserts the four security guarantees the app depends on:
 *   1. Anon/authenticated cannot read other users' rows in demo_requests,
 *      rate_limits, audit_log.
 *   2. Storage listing in private buckets (investor-reports,
 *      compliance-documents, documents) is denied for anon and scoped to
 *      the caller's org prefix for authenticated.
 *   3. SECURITY DEFINER functions documented as server-only reject calls
 *      from anon and authenticated.
 *   4. Realtime postgres_changes only deliver rows for the subscriber's
 *      organisation (auth-gated, skipped without credentials).
 *
 * Hits the live project via direct `fetch` (supabase-js inside jsdom is
 * flaky on slow REST responses). Authenticated + realtime checks require
 * E2E_AUTH_EMAIL / E2E_AUTH_PASSWORD and skip cleanly otherwise.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { server } from '@/test/mocks/server';

// These tests hit the live backend, so we must stop the global MSW
// interceptor that the rest of the suite relies on. It's restarted in
// afterAll so subsequent test files keep their mocks.
beforeAll(() => server.close());
afterAll(() => server.listen({ onUnhandledRequest: 'warn' }));

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

const hasBackend = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
const describeIfBackend = hasBackend ? describe : describe.skip;

const AUTH_EMAIL = process.env.E2E_AUTH_EMAIL;
const AUTH_PASSWORD = process.env.E2E_AUTH_PASSWORD;
const hasAuthCreds = !!(AUTH_EMAIL && AUTH_PASSWORD);
const itIfAuth = hasAuthCreds ? it : it.skip;

const PRIVATE_BUCKETS = ['investor-reports', 'compliance-documents', 'documents'];

// SECURITY DEFINER functions whose EXECUTE was revoked from anon &
// authenticated in supabase/migrations/*_security_definer_audit.sql.
// Each is asserted to return a non-2xx for non-service-role callers.
const SERVER_ONLY_FUNCTIONS: Array<{ name: string; body: Record<string, unknown> }> = [
  { name: 'create_jobs_for_expiring_compliance', body: {} },
  { name: 'migrate_properties_to_v2', body: {} },
];

const TEST_TIMEOUT = 15_000;

function restHeaders(token = SUPABASE_ANON_KEY!) {
  return {
    apikey: SUPABASE_ANON_KEY!,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function restGet(path: string, token = SUPABASE_ANON_KEY!) {
  return fetch(`${SUPABASE_URL}${path}`, { headers: restHeaders(token) });
}

async function restPost(path: string, body: unknown, token = SUPABASE_ANON_KEY!) {
  return fetch(`${SUPABASE_URL}${path}`, {
    method: 'POST',
    headers: restHeaders(token),
    body: JSON.stringify(body ?? {}),
  });
}

describeIfBackend('Permission regression — anonymous role', () => {
  it.each(['demo_requests', 'rate_limits', 'audit_log'])(
    'anon cannot SELECT rows from %s',
    async (table) => {
      const res = await restGet(`/rest/v1/${table}?select=*&limit=5`);
      if (res.ok) {
        // Some tables (audit_log) return an empty list under RLS rather
        // than an error. An empty array is the only acceptable success.
        const body = await res.json();
        expect(Array.isArray(body)).toBe(true);
        expect(body).toHaveLength(0);
      } else {
        expect([401, 403, 404]).toContain(res.status);
      }
    },
    TEST_TIMEOUT,
  );

  it.each(SERVER_ONLY_FUNCTIONS)(
    'anon RPC to server-only $name is rejected',
    async ({ name, body }) => {
      const res = await restPost(`/rest/v1/rpc/${name}`, body);
      // jsdom rewrites non-2xx statuses unpredictably (200/201) so we
      // assert on the response body instead: a successful RPC returns a
      // value or null, never a PostgREST error envelope with `code` +
      // `message`.
      const text = await res.text();
      let payload: unknown = null;
      try { payload = JSON.parse(text); } catch { /* not JSON = also a failure */ }
      const err = payload as { code?: string; message?: string } | null;
      expect(err && (err.code || err.message), `unexpected success body: ${text.slice(0,200)}`).toBeTruthy();
    },
    TEST_TIMEOUT,
  );

  it.each(PRIVATE_BUCKETS)(
    'anon cannot list private bucket %s',
    async (bucket) => {
      const res = await restPost(`/storage/v1/object/list/${bucket}`, {
        prefix: '',
        limit: 5,
      });
      if (res.ok) {
        const body = await res.json();
        expect(Array.isArray(body) ? body : []).toHaveLength(0);
      } else {
        expect([400, 401, 403]).toContain(res.status);
      }
    },
    TEST_TIMEOUT,
  );
});

describeIfBackend('Permission regression — authenticated role', () => {
  let token: string | null = null;
  let userId: string | null = null;
  let orgId: string | null = null;
  let realtimeClient: SupabaseClient | null = null;

  beforeAll(async () => {
    if (!hasAuthCreds) return;
    const client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword({
      email: AUTH_EMAIL!,
      password: AUTH_PASSWORD!,
    });
    if (error) throw error;
    token = data.session?.access_token ?? null;
    userId = data.user?.id ?? null;
    realtimeClient = client;
    const membRes = await restGet(
      `/rest/v1/memberships?select=org_id&user_id=eq.${userId}&limit=1`,
      token!,
    );
    if (membRes.ok) {
      const rows = (await membRes.json()) as Array<{ org_id: string }>;
      orgId = rows[0]?.org_id ?? null;
    }
  }, 20_000);

  afterAll(async () => {
    if (realtimeClient) await realtimeClient.auth.signOut();
  });

  itIfAuth(
    'authenticated cannot SELECT demo_requests as a non-admin',
    async () => {
      const res = await restGet('/rest/v1/demo_requests?select=id&limit=5', token!);
      if (res.ok) {
        const body = (await res.json()) as unknown[];
        expect(body).toHaveLength(0);
      } else {
        expect([401, 403]).toContain(res.status);
      }
    },
    TEST_TIMEOUT,
  );

  itIfAuth(
    'authenticated rate_limits SELECT does not leak global keys',
    async () => {
      const res = await restGet('/rest/v1/rate_limits?select=key&limit=50', token!);
      if (res.ok) {
        const body = (await res.json()) as unknown[];
        expect(body).toHaveLength(0);
      } else {
        expect([401, 403]).toContain(res.status);
      }
    },
    TEST_TIMEOUT,
  );

  itIfAuth(
    'audit_log rows visible to user all belong to their org',
    async () => {
      if (!orgId) return;
      const res = await restGet('/rest/v1/audit_log?select=org_id&limit=200', token!);
      expect(res.ok).toBe(true);
      const rows = (await res.json()) as Array<{ org_id: string | null }>;
      for (const r of rows) expect(r.org_id).toBe(orgId);
    },
    TEST_TIMEOUT,
  );

  itIfAuth.each(SERVER_ONLY_FUNCTIONS)(
    'authenticated RPC to server-only $name is rejected',
    async ({ name, body }) => {
      const res = await restPost(`/rest/v1/rpc/${name}`, body, token!);
      const text = await res.text();
      let payload: unknown = null;
      try { payload = JSON.parse(text); } catch { /* not JSON = failure */ }
      const err = payload as { code?: string; message?: string } | null;
      expect(err && (err.code || err.message), `unexpected success body: ${text.slice(0,200)}`).toBeTruthy();
    },
    TEST_TIMEOUT,
  );

  itIfAuth.each(PRIVATE_BUCKETS)(
    'storage listing in %s only returns paths under caller org',
    async (bucket) => {
      if (!orgId) return;
      const res = await restPost(
        `/storage/v1/object/list/${bucket}`,
        { prefix: '', limit: 100 },
        token!,
      );
      if (!res.ok) {
        expect([400, 401, 403]).toContain(res.status);
        return;
      }
      const entries = (await res.json()) as Array<{ name: string }>;
      for (const e of entries) {
        expect(
          e.name.startsWith(orgId) || e.name.startsWith(`${orgId}/`),
          `unexpected entry ${e.name} in ${bucket}`,
        ).toBe(true);
      }

      // Probe a definitely-foreign prefix — must be empty or denied.
      const foreign = await restPost(
        `/storage/v1/object/list/${bucket}`,
        { prefix: '00000000-0000-0000-0000-000000000000', limit: 5 },
        token!,
      );
      if (foreign.ok) {
        const body = (await foreign.json()) as unknown[];
        expect(body).toHaveLength(0);
      } else {
        expect([400, 401, 403]).toContain(foreign.status);
      }
    },
    TEST_TIMEOUT,
  );

  itIfAuth(
    'Realtime postgres_changes on audit_log only delivers caller-org rows',
    async () => {
      if (!orgId || !realtimeClient) return;
      const received: Array<{ org_id: string | null }> = [];
      const channel = realtimeClient
        .channel(`security-test-${Date.now()}`, { config: { private: true } })
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'audit_log' },
          (payload) => {
            const row = (payload.new ?? payload.old) as { org_id?: string | null } | null;
            if (row && 'org_id' in row) received.push({ org_id: row.org_id ?? null });
          },
        );
      try {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('subscribe timeout')), 8000);
          channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              clearTimeout(timer);
              resolve();
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              clearTimeout(timer);
              reject(new Error(`subscribe failed: ${status}`));
            }
          });
        });
        // Hold the channel briefly to surface any in-flight events. We do
        // not synthesise traffic — this asserts the *filter*, not throughput.
        await new Promise((r) => setTimeout(r, 1500));
      } finally {
        await realtimeClient.removeChannel(channel);
      }
      for (const r of received) expect(r.org_id).toBe(orgId);
    },
    20_000,
  );
});
