import type { Page, Route } from '@playwright/test';

type JsonBody = Record<string, unknown> | Array<unknown>;

const SUPABASE_ORIGIN = 'https://jnkwooocjpgpznittueo.supabase.co';

/**
 * Mock a Supabase REST endpoint (e.g. /rest/v1/properties).
 */
export async function mockSupabaseRest(
  page: Page,
  table: string,
  body: JsonBody,
  { method = 'GET', status = 200 }: { method?: string; status?: number } = {},
) {
  const pattern = new RegExp(`/rest/v1/${table}(\\?.*)?$`);
  await page.route(pattern, async (route: Route) => {
    if (route.request().method() === method) {
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    } else {
      await route.continue();
    }
  });
}

/**
 * Mock Supabase auth endpoints so the app thinks the user is logged in.
 * This avoids needing real credentials for most UI-level tests.
 */
export async function mockSupabaseAuth(page: Page) {
  // Mock getSession / token refresh
  await page.route(`${SUPABASE_ORIGIN}/auth/v1/token**`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'e2e-fake-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'e2e-fake-refresh-token',
        user: {
          id: 'e2e-user-1',
          email: 'e2e@tenureiq.test',
          email_confirmed_at: '2025-01-01T00:00:00Z',
        },
      }),
    });
  });

  // Mock getUser
  await page.route(`${SUPABASE_ORIGIN}/auth/v1/user`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'e2e-user-1',
        email: 'e2e@tenureiq.test',
        email_confirmed_at: '2025-01-01T00:00:00Z',
      }),
    });
  });

  // Mock memberships so the app resolves an org
  await mockSupabaseRest(page, 'memberships', [
    { id: 'mem-1', user_id: 'e2e-user-1', org_id: 'org-1', role: 'owner' },
  ]);
}

/**
 * Inject a fake Supabase session into sessionStorage so the app
 * considers the user authenticated on page load.
 */
export async function injectFakeSession(page: Page) {
  await page.addInitScript(() => {
    const fakeSession = {
      access_token: 'e2e-fake-access-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'e2e-fake-refresh-token',
      user: {
        id: 'e2e-user-1',
        email: 'e2e@tenureiq.test',
        email_confirmed_at: '2025-01-01T00:00:00Z',
        app_metadata: { provider: 'email' },
        user_metadata: {},
        aud: 'authenticated',
        role: 'authenticated',
      },
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
    sessionStorage.setItem(
      'sb-jnkwooocjpgpznittueo-auth-token',
      JSON.stringify(fakeSession),
    );
  });
}
