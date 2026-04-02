import type { Page } from '@playwright/test';

const authEmail = process.env.E2E_AUTH_EMAIL;
const authPassword = process.env.E2E_AUTH_PASSWORD;

export function hasAuthCredentials(): boolean {
  return !!(authEmail && authPassword);
}

/**
 * Log in via the /auth page and wait for redirect to the dashboard.
 * Requires E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD environment variables.
 */
export async function login(page: Page): Promise<void> {
  if (!authEmail || !authPassword) {
    throw new Error('E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD must be set');
  }

  await page.goto('/auth');
  await page.fill('input[type="email"]', authEmail);
  await page.fill('input[type="password"]', authPassword);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}
