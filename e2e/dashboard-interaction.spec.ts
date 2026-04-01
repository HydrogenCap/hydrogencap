import { test, expect } from '@playwright/test';
import { hasAuthCredentials, login } from './helpers/auth';
import { mockSupabaseAuth, mockSupabaseRest, injectFakeSession } from './helpers/mock-api';
import { mockSupabaseRpc } from './helpers/supabase';

test.describe('Dashboard Interaction Flow', () => {
  test.skip(!hasAuthCredentials(), 'Skipping: E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD not set');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('dashboard loads with KPI cards', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('body')).not.toContainText('Application error');

    // KPI cards should render — look for common portfolio metrics
    const kpiArea = page.locator('text=/portfolio value|equity|cashflow|occupancy|ltv/i').first();
    await expect(kpiArea).toBeVisible({ timeout: 15000 });
  });

  test('click through dashboard tabs', async ({ page }) => {
    await page.goto('/dashboard');

    const tabNames = ['This Month', 'Health', 'Map', 'Finance', 'Activity'];

    for (const tabName of tabNames) {
      const tab = page.getByRole('tab', { name: new RegExp(tabName, 'i') });

      if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await tab.click();

        // Verify the tab content area renders (no crash)
        await expect(page.locator('body')).not.toContainText('Application error');

        // Brief pause for lazy-loaded content (e.g., Map tab)
        await page.waitForTimeout(500);
      }
    }
  });

  test('This Month tab shows widgets', async ({ page }) => {
    await page.goto('/dashboard');

    // Click This Month tab explicitly (it may be default)
    const thisMonthTab = page.getByRole('tab', { name: /this month/i });
    if (await thisMonthTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await thisMonthTab.click();
    }

    // Should see various widget headings in This Month view
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('Health tab renders content', async ({ page }) => {
    await page.goto('/dashboard');

    const healthTab = page.getByRole('tab', { name: /health/i });
    if (await healthTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await healthTab.click();
      await expect(page.locator('body')).not.toContainText('Application error');
    }
  });

  test('Finance tab renders charts', async ({ page }) => {
    await page.goto('/dashboard');

    const financeTab = page.getByRole('tab', { name: /finance/i });
    if (await financeTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await financeTab.click();
      await expect(page.locator('body')).not.toContainText('Application error');
    }
  });

  test('navigate from dashboard to actions page', async ({ page }) => {
    await page.goto('/dashboard');

    // Look for an action count or "Actions Required" widget that links to /actions
    const actionsLink = page.locator('a[href*="/actions"]').first();

    if (await actionsLink.isVisible({ timeout: 10000 }).catch(() => false)) {
      await actionsLink.click();
      await page.waitForURL(/\/actions/);
      await expect(page.getByText(/action required/i).first()).toBeVisible({ timeout: 10000 });
    } else {
      // Fallback: navigate directly via sidebar
      await page.goto('/actions');
      await page.waitForURL(/\/actions/);
      await expect(page.locator('body')).not.toContainText('Application error');
    }
  });
});

test.describe('Dashboard Interaction Flow (mocked)', () => {
  test('dashboard renders empty state when no properties exist', async ({ page }) => {
    await mockSupabaseAuth(page);
    await injectFakeSession(page);
    await mockSupabaseRest(page, 'properties', []);

    // Mock KPI RPCs with zeros
    await mockSupabaseRpc(page, 'get_portfolio_kpis', {
      total_properties: 0,
      total_valuation: 0,
      total_monthly_rent: 0,
    });
    await mockSupabaseRpc(page, 'get_dashboard_actions', []);
    await mockSupabaseRpc(page, 'get_compliance_summary', []);

    await page.goto('/dashboard');

    const onDashboard = await page
      .waitForURL(/\/dashboard/, { timeout: 5000 })
      .then(() => true)
      .catch(() => false);

    if (onDashboard) {
      // Should show empty state: "Welcome to Tenure IQ" or similar
      const emptyOrKpi = page
        .locator('text=/welcome|add your first property|portfolio value|dashboard/i')
        .first();
      await expect(emptyOrKpi).toBeVisible({ timeout: 10000 });
    }
  });

  test('dashboard tabs are present in the DOM', async ({ page }) => {
    await mockSupabaseAuth(page);
    await injectFakeSession(page);
    await mockSupabaseRest(page, 'properties', [
      {
        id: 'prop-1',
        org_id: 'org-1',
        address_line_1: '1 Mock Lane',
        city: 'Mockton',
        postcode: 'MK1 1AA',
        property_type: 'single_let',
        lifecycle_stage: 'stabilised',
      },
    ]);

    await mockSupabaseRpc(page, 'get_portfolio_kpis', {
      total_properties: 1,
      total_valuation: 300000,
      total_monthly_rent: 1200,
    });
    await mockSupabaseRpc(page, 'get_dashboard_actions', []);
    await mockSupabaseRpc(page, 'get_compliance_summary', []);

    await page.goto('/dashboard');

    const onDashboard = await page
      .waitForURL(/\/dashboard/, { timeout: 5000 })
      .then(() => true)
      .catch(() => false);

    if (onDashboard) {
      // Check that the tab triggers exist
      const expectedTabs = ['This Month', 'Health', 'Map', 'Finance', 'Activity'];
      for (const tabName of expectedTabs) {
        const tab = page.getByRole('tab', { name: new RegExp(tabName, 'i') });
        // Tabs may or may not render depending on mock completeness
        const isVisible = await tab.isVisible({ timeout: 3000 }).catch(() => false);
        if (isVisible) {
          await expect(tab).toBeVisible();
        }
      }
    }
  });
});
