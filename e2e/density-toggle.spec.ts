import { test, expect } from '@playwright/test';
import { hasAuthCredentials, login } from './helpers/auth';

/**
 * Density toggle smoke — verifies that toggling Cosy/Dense
 * mutates document.body.dataset.density globally.
 * Requires real auth credentials; otherwise skipped.
 */
test.describe('Global density toggle', () => {
  test.skip(!hasAuthCredentials(), 'Skipping: E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD not set');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('toggles document.body.dataset.density between cosy and dense', async ({ page }) => {
    await page.goto('/rent');

    const toggle = page.getByTestId('density-toggle');
    await expect(toggle).toBeVisible({ timeout: 10000 });

    // Default should be cosy → no data-density attribute on body
    const initial = await page.evaluate(() => document.body.dataset.density ?? '');
    expect(['', 'cosy']).toContain(initial);

    // Click "Dense"
    await toggle.getByRole('button', { name: /Dense/i }).click();
    await expect
      .poll(() => page.evaluate(() => document.body.dataset.density ?? ''), {
        timeout: 5000,
      })
      .toBe('dense');

    // Click "Cosy"
    await toggle.getByRole('button', { name: /Cosy/i }).click();
    await expect
      .poll(() => page.evaluate(() => document.body.dataset.density ?? ''), {
        timeout: 5000,
      })
      .not.toBe('dense');
  });
});
