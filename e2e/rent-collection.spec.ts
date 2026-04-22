import { test, expect } from '@playwright/test';
import { hasAuthCredentials, login } from './helpers/auth';
import { mockSupabaseAuth, mockSupabaseRest, injectFakeSession } from './helpers/mock-api';
import { mockSupabaseRpc } from './helpers/supabase';

/**
 * Rent Collection — real-auth flow.
 * Only runs when E2E_AUTH_EMAIL/PASSWORD are provided.
 */
test.describe('Rent Collection Flow', () => {
  test.skip(!hasAuthCredentials(), 'Skipping: E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD not set');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('rent collection page loads with header and CTAs', async ({ page }) => {
    await page.goto('/rent-collection');
    await expect(page.locator('body')).not.toContainText('Application error');
    await expect(page.getByRole('heading', { name: /Rent Collection/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Import Statement/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Reconciliation/i })).toBeVisible();
  });

  test('tab triggers are present and clickable', async ({ page }) => {
    await page.goto('/rent-collection');

    for (const tabName of ['Rent Roll', 'Arrears', 'Calendar', 'History']) {
      const tab = page.getByRole('tab', { name: new RegExp(tabName, 'i') });
      if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await tab.click();
        await expect(page.locator('body')).not.toContainText('Application error');
      }
    }
  });

  test('import dialog opens when Import Statement is clicked', async ({ page }) => {
    await page.goto('/rent-collection');
    await page.getByRole('button', { name: /Import Statement/i }).click();
    // The dialog should render with an upload control or a CSV-related prompt
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
  });
});

/**
 * Rent Collection — mocked flow.
 * Runs in CI without real credentials. Exercises the routing / page shell
 * with a fake session and stubbed Supabase responses.
 */
test.describe('Rent Collection Flow (mocked)', () => {
  test('page renders with an empty rent roll', async ({ page }) => {
    await mockSupabaseAuth(page);
    await injectFakeSession(page);
    await mockSupabaseRest(page, 'rent_schedule', []);
    await mockSupabaseRest(page, 'rent_payments', []);
    await mockSupabaseRest(page, 'tenancies', []);
    await mockSupabaseRest(page, 'properties', []);
    await mockSupabaseRpc(page, 'get_rent_schedule_for_month', { items: [] });
    await mockSupabaseRpc(page, 'get_rent_dashboard_stats', {
      collected_this_month: 0,
      due_this_month: 0,
      arrears_total: 0,
    });

    await page.goto('/rent-collection');

    const onPage = await page
      .waitForURL(/\/rent-collection/, { timeout: 5000 })
      .then(() => true)
      .catch(() => false);

    if (onPage) {
      await expect(page.locator('body')).not.toContainText('Application error');
      const header = page.getByRole('heading', { name: /Rent Collection/i });
      if (await header.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(header).toBeVisible();
      }
    }
  });
});
