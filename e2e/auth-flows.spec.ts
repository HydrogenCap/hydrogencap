import { test, expect } from '@playwright/test';

// These tests require valid credentials
// Skip in CI unless E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD are set
const authEmail = process.env.E2E_AUTH_EMAIL;
const authPassword = process.env.E2E_AUTH_PASSWORD;

test.describe('Authenticated Flows', () => {
  test.skip(!authEmail || !authPassword, 'Skipping: E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD not set');

  test('can log in and reach dashboard', async ({ page }) => {
    await page.goto('/auth');

    await page.fill('input[type="email"]', authEmail!);
    await page.fill('input[type="password"]', authPassword!);
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    expect(page.url()).toContain('/dashboard');

    // Dashboard should show key elements
    await expect(page.locator('text=/portfolio|properties|dashboard/i').first()).toBeVisible();
  });
});
