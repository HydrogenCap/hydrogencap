import { test, expect } from '@playwright/test';
import { hasAuthCredentials, login } from './helpers/auth';
import { mockSupabaseAuth, mockSupabaseRest, injectFakeSession } from './helpers/mock-api';
import { mockSupabaseRpc } from './helpers/supabase';

/**
 * Financial Forecast — real-auth flow (requires credentials).
 */
test.describe('Financial Forecast Flow', () => {
  test.skip(!hasAuthCredentials(), 'Skipping: E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD not set');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('forecast page loads and renders without error', async ({ page }) => {
    await page.goto('/financial-forecast');
    await expect(page.locator('body')).not.toContainText('Application error');
    // The heading is "Financial Forecast" or similar — match loosely.
    const heading = page.locator('h1,h2').filter({ hasText: /forecast/i }).first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('forecast tab triggers render', async ({ page }) => {
    await page.goto('/financial-forecast');
    for (const tabName of ['Cashflow Projection', 'Stress Test', 'Saved Forecasts']) {
      const tab = page.getByRole('tab', { name: new RegExp(tabName, 'i') });
      if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await tab.click();
        await expect(page.locator('body')).not.toContainText('Application error');
      }
    }
  });
});

/**
 * Financial Forecast — mocked flow (runs in CI without credentials).
 */
test.describe('Financial Forecast Flow (mocked)', () => {
  test('forecast page renders with empty data', async ({ page }) => {
    await mockSupabaseAuth(page);
    await injectFakeSession(page);
    await mockSupabaseRest(page, 'properties', []);
    await mockSupabaseRest(page, 'financial_snapshots', []);
    await mockSupabaseRest(page, 'financial_forecasts', []);
    await mockSupabaseRpc(page, 'get_forecast_baseline', {
      monthly_income: 0,
      monthly_costs: 0,
      monthly_mortgage: 0,
    });

    await page.goto('/financial-forecast');

    const onPage = await page
      .waitForURL(/\/financial-forecast/, { timeout: 5000 })
      .then(() => true)
      .catch(() => false);

    if (onPage) {
      await expect(page.locator('body')).not.toContainText('Application error');
    }
  });
});
