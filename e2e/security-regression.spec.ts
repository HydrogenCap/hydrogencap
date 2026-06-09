/**
 * Security regression e2e — browser-side counterpart to
 * src/__tests__/security/permission-regression.test.ts.
 *
 * Runs against a real preview/staging environment. Skips cleanly when
 * E2E_AUTH_EMAIL / E2E_AUTH_PASSWORD are not provided so it doesn't gate
 * smoke runs that lack credentials.
 */

import { expect, test } from '@playwright/test';
import { hasAuthCredentials, login } from './helpers/auth';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;

const PRIVATE_BUCKETS = ['investor-reports', 'compliance-documents', 'documents'];
const SERVER_ONLY_FUNCTIONS = [
  'create_jobs_for_expiring_compliance',
  'migrate_properties_to_v2',
  'recalculate_all_ltvs',
];

test.describe('Security regression', () => {
  test.skip(
    !SUPABASE_URL || !SUPABASE_ANON_KEY,
    'VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY required',
  );

  test('anon REST cannot read demo_requests, rate_limits, audit_log', async ({ request }) => {
    for (const table of ['demo_requests', 'rate_limits', 'audit_log']) {
      const res = await request.get(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=5`, {
        headers: { apikey: SUPABASE_ANON_KEY!, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      });
      // Either RLS returns [] (200) or PostgREST returns 401/403.
      if (res.ok()) {
        expect(await res.json()).toEqual([]);
      } else {
        expect([401, 403, 404]).toContain(res.status());
      }
    }
  });

  test('anon RPC to server-only SECURITY DEFINER functions is rejected', async ({ request }) => {
    for (const fn of SERVER_ONLY_FUNCTIONS) {
      const res = await request.post(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
        headers: {
          apikey: SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        data: {},
      });
      expect(res.ok(), `${fn} should not succeed for anon`).toBe(false);
      expect([401, 403, 404]).toContain(res.status());
    }
  });

  test('anon cannot list private storage buckets', async ({ request }) => {
    for (const bucket of PRIVATE_BUCKETS) {
      const res = await request.post(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
        headers: {
          apikey: SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        data: { prefix: '', limit: 5 },
      });
      if (res.ok()) {
        expect(await res.json()).toEqual([]);
      } else {
        expect([400, 401, 403]).toContain(res.status());
      }
    }
  });

  test('authenticated session sees only own-org storage prefixes', async ({ page }) => {
    test.skip(!hasAuthCredentials(), 'E2E_AUTH_EMAIL / E2E_AUTH_PASSWORD not set');
    await login(page);

    // Run REST/storage calls inside the page so the live access token is
    // attached automatically by the supabase client.
    const result = await page.evaluate(
      async ({ buckets }) => {
        // @ts-expect-error window.supabase isn't typed at runtime
        const sb = (window as any).supabase ?? null;
        const client = sb ?? (await import('/src/integrations/supabase/client.ts')).supabase;
        const { data: { user } } = await client.auth.getUser();
        const { data: memb } = await client
          .from('memberships')
          .select('org_id')
          .eq('user_id', user!.id)
          .limit(1)
          .maybeSingle();
        const orgId: string | null = memb?.org_id ?? null;

        const listings: Record<string, string[]> = {};
        for (const bucket of buckets) {
          const { data } = await client.storage.from(bucket).list('', { limit: 100 });
          listings[bucket] = (data ?? []).map((e: { name: string }) => e.name);
        }

        const { data: auditRows } = await client.from('audit_log').select('org_id').limit(100);

        return { orgId, listings, auditOrgIds: (auditRows ?? []).map((r: any) => r.org_id) };
      },
      { buckets: PRIVATE_BUCKETS },
    );

    if (result.orgId) {
      for (const bucket of PRIVATE_BUCKETS) {
        for (const name of result.listings[bucket]) {
          expect(name.startsWith(result.orgId!), `${bucket}/${name}`).toBe(true);
        }
      }
      for (const orgId of result.auditOrgIds) {
        expect(orgId).toBe(result.orgId);
      }
    }
  });
});
