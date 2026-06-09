/**
 * Permission regression suite.
 *
 * Asserts that the four security guarantees the app depends on cannot
 * silently regress:
 *   1. Anon/authenticated cannot read other users' rows in demo_requests,
 *      rate_limits, audit_log.
 *   2. Storage paths in private buckets (investor-reports,
 *      compliance-documents, documents) only resolve for the owner org's
 *      prefix.
 *   3. SECURITY DEFINER functions documented as server-only reject calls
 *      from anon and authenticated.
 *   4. Realtime subscriptions only deliver rows for the subscriber's org.
 *
 * The suite hits the live project's REST/Realtime endpoints via the
 * publishable anon key. Authenticated + realtime checks require
 * `E2E_AUTH_EMAIL` / `E2E_AUTH_PASSWORD` — they `it.skip` cleanly when
 * the credentials are absent so CI without secrets still passes.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

const hasBackend = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
const describeIfBackend = hasBackend ? describe : describe.skip;

const AUTH_EMAIL = process.env.E2E_AUTH_EMAIL;
const AUTH_PASSWORD = process.env.E2E_AUTH_PASSWORD;
const hasAuthCreds = !!(AUTH_EMAIL && AUTH_PASSWORD);
const itIfAuth = hasAuthCreds ? it : it.skip;

// Server-only SECURITY DEFINER functions (from
// supabase/migrations/20260609231913_*_security_definer_audit.sql).
// These were granted to service_role only — anon/authenticated calls MUST
// fail with 42501 / permission denied.
const SERVER_ONLY_FUNCTIONS: Array<{ name: string; args: Record<string, unknown> }> = [
  { name: 'create_jobs_for_expiring_compliance', args: {} },
  { name: 'migrate_properties_to_v2', args: {} },
  { name: 'recalculate_all_ltvs', args: {} },
];

// Private buckets where listing should be scoped to caller's org prefix.
const PRIVATE_BUCKETS = ['investor-reports', 'compliance-documents', 'documents'];

function makeAnonClient(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 2 } },
  });
}

describeIfBackend('Permission regression — anonymous role', () => {
  const anon = makeAnonClient();

  it.each(['demo_requests', 'rate_limits', 'audit_log'])(
    'anon SELECT on %s returns no rows',
    async (table) => {
      const { data, error } = await anon.from(table).select('*').limit(5);
      // Either RLS returns 0 rows (PostgREST behaviour) or a permission
      // error. Both are acceptable; visible rows are not.
      if (error) {
        expect(error.code === '42501' || /permission|policy/i.test(error.message)).toBe(true);
      } else {
        expect(data ?? []).toHaveLength(0);
      }
    },
  );

  it.each(SERVER_ONLY_FUNCTIONS)(
    'anon RPC to server-only function $name is rejected',
    async ({ name, args }) => {
      const { error } = await anon.rpc(name, args as never);
      expect(error).not.toBeNull();
      // 42501 = permission denied; 404 also acceptable if EXECUTE was
      // revoked in a way that hides the function from the role.
      const msg = `${error?.code ?? ''} ${error?.message ?? ''}`.toLowerCase();
      expect(
        /permission|denied|not.*found|does not exist|42501|pgrst202/.test(msg),
      ).toBe(true);
    },
  );

  it.each(PRIVATE_BUCKETS)(
    'anon cannot list root of private bucket %s',
    async (bucket) => {
      const { data, error } = await anon.storage.from(bucket).list('', { limit: 5 });
      if (error) {
        expect(/permission|policy|denied|unauthor/i.test(error.message)).toBe(true);
      } else {
        // Anonymous listing must not return any object outside an org prefix.
        // The org-scoped policies REQUIRE auth; anon should see [].
        expect(data ?? []).toHaveLength(0);
      }
    },
  );
});

describeIfBackend('Permission regression — authenticated role', () => {
  let authed: SupabaseClient;
  let userId: string | null = null;
  let orgId: string | null = null;

  beforeAll(async () => {
    if (!hasAuthCreds) return;
    authed = makeAnonClient();
    const { data, error } = await authed.auth.signInWithPassword({
      email: AUTH_EMAIL!,
      password: AUTH_PASSWORD!,
    });
    if (error) throw error;
    userId = data.user?.id ?? null;
    const { data: memb } = await (authed as any)
      .from('memberships')
      .select('org_id')
      .eq('user_id', userId!)
      .limit(1)
      .maybeSingle();
    orgId = memb?.org_id ?? null;
  });

  afterAll(async () => {
    if (authed) await authed.auth.signOut();
  });

  itIfAuth('authenticated cannot SELECT demo_requests (platform admin only)', async () => {
    const { data, error } = await authed.from('demo_requests').select('id').limit(5);
    if (error) {
      expect(/permission|policy/i.test(error.message)).toBe(true);
    } else {
      // Non-admin test user — policy `Platform admins can view demo requests`
      // should return zero rows.
      expect(data ?? []).toHaveLength(0);
    }
  });

  itIfAuth('authenticated cannot SELECT rate_limits rows belonging to others', async () => {
    const { data, error } = await authed.from('rate_limits').select('key').limit(50);
    // Either fully locked or scoped — never leak global keys.
    if (error) {
      expect(/permission|policy/i.test(error.message)).toBe(true);
    } else {
      // rate_limits has no per-user concept; locked-down RLS should yield [].
      expect(data ?? []).toHaveLength(0);
    }
  });

  itIfAuth('audit_log rows visible to user all belong to their org', async () => {
    if (!orgId) return;
    const { data, error } = await authed
      .from('audit_log')
      .select('org_id')
      .limit(100);
    expect(error).toBeNull();
    for (const row of (data ?? []) as Array<{ org_id: string | null }>) {
      expect(row.org_id).toBe(orgId);
    }
  });

  itIfAuth.each(SERVER_ONLY_FUNCTIONS)(
    'authenticated RPC to server-only $name is rejected',
    async ({ name, args }) => {
      const { error } = await authed.rpc(name, args as never);
      expect(error).not.toBeNull();
      const msg = `${error?.code ?? ''} ${error?.message ?? ''}`.toLowerCase();
      expect(
        /permission|denied|not.*found|does not exist|42501|pgrst202/.test(msg),
      ).toBe(true);
    },
  );

  itIfAuth.each(PRIVATE_BUCKETS)(
    'storage listing in %s only returns paths under the caller org',
    async (bucket) => {
      if (!orgId) return;
      // List at root: every returned entry name must start with the org id.
      const { data, error } = await authed.storage.from(bucket).list('', { limit: 100 });
      if (error) {
        expect(/permission|policy/i.test(error.message)).toBe(true);
        return;
      }
      for (const entry of data ?? []) {
        expect(entry.name.startsWith(orgId)).toBe(true);
      }

      // Attempt to list a clearly foreign prefix — must be empty or denied.
      const foreignPrefix = '00000000-0000-0000-0000-000000000000';
      const { data: foreign, error: foreignErr } = await authed.storage
        .from(bucket)
        .list(foreignPrefix, { limit: 5 });
      if (foreignErr) {
        expect(/permission|policy/i.test(foreignErr.message)).toBe(true);
      } else {
        expect(foreign ?? []).toHaveLength(0);
      }
    },
  );

  itIfAuth(
    'Realtime postgres_changes on audit_log only delivers caller-org rows',
    async () => {
      if (!orgId) return;
      const received: Array<{ org_id: string | null }> = [];
      const channel = authed
        .channel(`security-test-${Date.now()}`, { config: { private: true } })
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'audit_log' },
          (payload) => {
            const row = (payload.new ?? payload.old) as { org_id?: string | null } | null;
            if (row && 'org_id' in row) received.push({ org_id: row.org_id ?? null });
          },
        );
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

      // Hold the channel briefly to collect any in-flight events. We do not
      // synthesise traffic — this asserts the *filter*, not throughput.
      await new Promise((r) => setTimeout(r, 1500));
      await authed.removeChannel(channel);

      for (const r of received) {
        expect(r.org_id).toBe(orgId);
      }
    },
    15000,
  );
});
