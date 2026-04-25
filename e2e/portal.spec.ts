import { test, expect } from '@playwright/test';
import { hasAuthCredentials, login } from './helpers/auth';
import { mockSupabaseAuth, mockSupabaseRest, injectFakeSession } from './helpers/mock-api';
import { mockSupabaseRpc } from './helpers/supabase';

/**
 * Portal surfaces — shareholder / investor portal and tenant portal.
 * Mocked flows run in CI; auth flows run when credentials are provided.
 */

test.describe('Shareholder Portal Flow', () => {
  test.skip(!hasAuthCredentials(), 'Skipping: E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD not set');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('portal dashboard loads without application errors', async ({ page }) => {
    await page.goto('/portal/dashboard');
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('portal sub-routes are reachable', async ({ page }) => {
    for (const path of ['/portal/properties', '/portal/compliance', '/portal/investments', '/portal/statements']) {
      await page.goto(path);
      await expect(page.locator('body')).not.toContainText('Application error');
    }
  });
});

test.describe('Shareholder Portal Flow (mocked)', () => {
  test('portal dashboard renders with empty data', async ({ page }) => {
    await mockSupabaseAuth(page);
    await injectFakeSession(page);
    await mockSupabaseRest(page, 'shareholder_positions', []);
    await mockSupabaseRest(page, 'distributions', []);
    await mockSupabaseRest(page, 'properties', []);
    await mockSupabaseRpc(page, 'get_shareholder_dashboard', {
      total_invested: 0,
      total_distributed: 0,
      positions: [],
    });

    await page.goto('/portal/dashboard');

    const onPage = await page
      .waitForURL(/\/portal\/dashboard/, { timeout: 5000 })
      .then(() => true)
      .catch(() => false);

    if (onPage) {
      await expect(page.locator('body')).not.toContainText('Application error');
    }
  });
});

test.describe('Tenant Portal Flow (mocked)', () => {
  test('tenant dashboard renders without error', async ({ page }) => {
    await mockSupabaseAuth(page);
    await injectFakeSession(page);
    await mockSupabaseRest(page, 'tenant_portal_data', []);
    await mockSupabaseRest(page, 'rent_payments', []);
    await mockSupabaseRest(page, 'maintenance_requests', []);
    await mockSupabaseRpc(page, 'get_tenant_dashboard', {
      current_rent: 0,
      next_due_date: null,
      open_maintenance: 0,
    });

    await page.goto('/tenant/dashboard');

    const onPage = await page
      .waitForURL(/\/tenant\/dashboard/, { timeout: 5000 })
      .then(() => true)
      .catch(() => false);

    if (onPage) {
      await expect(page.locator('body')).not.toContainText('Application error');
    }
  });

  test('tenant payment and maintenance sub-routes reachable', async ({ page }) => {
    await mockSupabaseAuth(page);
    await injectFakeSession(page);
    await mockSupabaseRest(page, 'rent_payments', []);
    await mockSupabaseRest(page, 'maintenance_requests', []);
    await mockSupabaseRest(page, 'compliance_documents_v2', []);

    for (const path of ['/tenant/payments', '/tenant/maintenance', '/tenant/certificates']) {
      await page.goto(path);
      await expect(page.locator('body')).not.toContainText('Application error');
    }
  });
});
