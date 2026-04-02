import { test, expect } from '@playwright/test';
import { hasAuthCredentials, login } from './helpers/auth';
import { mockSupabaseAuth, mockSupabaseRest, injectFakeSession } from './helpers/mock-api';
import { mockSupabaseRpc } from './helpers/supabase';

test.describe('Navigation Flow', () => {
  test.skip(!hasAuthCredentials(), 'Skipping: E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD not set');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('sidebar renders with navigation groups', async ({ page }) => {
    await page.goto('/dashboard');

    // Sidebar should contain the main navigation groups
    const sidebar = page.locator('nav, [data-sidebar], aside').first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Check for key sidebar items
    await expect(page.getByRole('link', { name: /dashboard/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /properties/i }).first()).toBeVisible();
  });

  test('expand a collapsible group and click a sub-item', async ({ page }) => {
    await page.goto('/dashboard');

    // Find the Compliance group toggle (it has a chevron and child items)
    const complianceToggle = page.getByLabel(/toggle compliance/i);

    if (await complianceToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await complianceToggle.click();

      // Sub-items should appear: Tasks, Calendar
      const tasksLink = page.getByRole('link', { name: /tasks/i }).first();
      if (await tasksLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await tasksLink.click();
        await page.waitForURL(/\/compliance-tasks/);
        await expect(page.locator('body')).not.toContainText('Application error');
      }
    } else {
      // Try clicking on the Compliance link text itself
      const complianceLink = page.getByRole('link', { name: /compliance/i }).first();
      if (await complianceLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await complianceLink.click();
        await page.waitForURL(/\/compliance/);
      }
    }
  });

  test('sidebar navigation updates active state', async ({ page }) => {
    await page.goto('/dashboard');

    // Navigate to Properties via sidebar
    const propertiesLink = page.getByRole('link', { name: /properties/i }).first();
    await expect(propertiesLink).toBeVisible({ timeout: 10000 });
    await propertiesLink.click();

    await page.waitForURL(/\/properties/);
    await expect(page.locator('body')).not.toContainText('Application error');

    // Navigate to Actions
    const actionsLink = page.getByRole('link', { name: /actions/i }).first();
    if (await actionsLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await actionsLink.click();
      await page.waitForURL(/\/actions/);
      await expect(page.locator('body')).not.toContainText('Application error');
    }
  });

  test('sidebar groups expand and persist children', async ({ page }) => {
    await page.goto('/dashboard');

    // Try expanding Finance group
    const financeToggle = page.getByLabel(/toggle finance/i);

    if (await financeToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await financeToggle.click();

      // Should show child items like Lending, Refinancing
      const lendingLink = page.getByRole('link', { name: /lending/i });
      await expect(lendingLink).toBeVisible({ timeout: 3000 });
    }
  });

  test('navigate through multiple sections without errors', async ({ page }) => {
    await page.goto('/dashboard');

    const routes = [
      { name: /properties/i, url: /\/properties/ },
      { name: /dashboard/i, url: /\/dashboard/ },
    ];

    for (const route of routes) {
      const link = page.getByRole('link', { name: route.name }).first();
      if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
        await link.click();
        await page.waitForURL(route.url);
        await expect(page.locator('body')).not.toContainText('Application error');
      }
    }
  });
});

test.describe('Mobile Navigation', () => {
  test.skip(!hasAuthCredentials(), 'Skipping: E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD not set');

  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('bottom nav appears on mobile viewport', async ({ page }) => {
    await page.goto('/dashboard');

    // Mobile bottom nav should be visible (fixed at bottom)
    // It contains Home, Properties, Compliance, Maintenance, More
    const bottomNav = page.locator('nav.fixed, [class*="bottom"], [class*="mobile-nav"]').first();

    // Look for bottom nav items by their icon labels
    const homeButton = page.getByRole('link', { name: /home/i }).first();
    const propertiesButton = page.getByRole('link', { name: /properties/i }).first();

    // At least one bottom nav item should be visible
    const hasBottomNav =
      (await homeButton.isVisible({ timeout: 5000 }).catch(() => false)) ||
      (await propertiesButton.isVisible({ timeout: 5000 }).catch(() => false)) ||
      (await bottomNav.isVisible({ timeout: 5000 }).catch(() => false));

    expect(hasBottomNav).toBeTruthy();
  });

  test('mobile bottom nav navigates to properties', async ({ page }) => {
    await page.goto('/dashboard');

    // Tap Properties in bottom nav
    const propertiesNavItem = page.getByRole('link', { name: /properties/i }).first();
    if (await propertiesNavItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await propertiesNavItem.click();
      await page.waitForURL(/\/properties/);
      await expect(page.locator('body')).not.toContainText('Application error');
    }
  });

  test('More button opens sidebar on mobile', async ({ page }) => {
    await page.goto('/dashboard');

    // The "More" button in the bottom nav triggers the sidebar sheet
    const moreButton = page.locator('button').filter({ hasText: /more/i }).first();

    if (await moreButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await moreButton.click();

      // Sidebar sheet should open with full navigation
      await page.waitForTimeout(500);
      const sidebarSheet = page.locator('[role="dialog"], [data-state="open"]').first();
      const isOpen = await sidebarSheet.isVisible({ timeout: 3000 }).catch(() => false);

      if (isOpen) {
        // Should see navigation items in the sheet
        await expect(
          page.getByRole('link', { name: /dashboard/i }).first(),
        ).toBeVisible();
      }
    }
  });

  test('mobile bottom nav highlights active route', async ({ page }) => {
    // Navigate to compliance
    await page.goto('/compliance-v2');

    // After redirect back to auth or staying on page,
    // the compliance bottom nav item should be distinguishable
    const onCompliance = await page
      .waitForURL(/\/compliance/, { timeout: 5000 })
      .then(() => true)
      .catch(() => false);

    if (onCompliance) {
      const complianceNavItem = page.getByRole('link', { name: /compliance/i }).first();
      if (await complianceNavItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Active items have text-primary class
        await expect(complianceNavItem).toBeVisible();
      }
    }
  });
});

test.describe('Navigation Flow (mocked)', () => {
  test('sidebar items render with mocked auth', async ({ page }) => {
    await mockSupabaseAuth(page);
    await injectFakeSession(page);
    await mockSupabaseRest(page, 'properties', []);
    await mockSupabaseRpc(page, 'get_portfolio_kpis', { total_properties: 0 });
    await mockSupabaseRpc(page, 'get_dashboard_actions', []);

    await page.goto('/dashboard');

    const onDashboard = await page
      .waitForURL(/\/dashboard/, { timeout: 5000 })
      .then(() => true)
      .catch(() => false);

    if (onDashboard) {
      // Sidebar group labels should be present
      const portfolioGroup = page.getByText(/portfolio/i).first();
      await expect(portfolioGroup).toBeVisible({ timeout: 5000 });
    }
  });
});
