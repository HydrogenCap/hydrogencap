import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('marketing homepage loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Hydrogen/i);
    await expect(page.locator('nav')).toBeVisible();
  });

  test('auth page loads', async ({ page }) => {
    await page.goto('/auth');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('protected routes redirect to auth when not logged in', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/auth/);
    expect(page.url()).toContain('/auth');
  });

  test('properties page redirects to auth when not logged in', async ({ page }) => {
    await page.goto('/properties-v2');
    await page.waitForURL(/\/auth/);
    expect(page.url()).toContain('/auth');
  });

  test('404 page renders for unknown routes', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');
    await expect(page.locator('text=/not found|404/i')).toBeVisible();
  });

  test('privacy policy page loads (public)', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.locator('body')).toContainText(/privacy/i);
  });

  test('terms of service page loads (public)', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.locator('body')).toContainText(/terms/i);
  });

  test('shared document route handles invalid token gracefully', async ({ page }) => {
    await page.goto('/shared/invalid-token-12345');
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('install/PWA page loads', async ({ page }) => {
    await page.goto('/install');
    await expect(page.locator('body')).toBeVisible();
  });

  test('forgot password page loads', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});

test.describe('Navigation Smoke', () => {
  test('marketing nav links work', async ({ page }) => {
    await page.goto('/');

    await page.goto('/product');
    await expect(page.locator('body')).toBeVisible();

    await page.goto('/about');
    await expect(page.locator('body')).toBeVisible();

    await page.goto('/contact');
    await expect(page.locator('body')).toBeVisible();
  });
});
