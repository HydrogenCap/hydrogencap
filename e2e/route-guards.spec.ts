import { expect, test } from '@playwright/test';

const protectedPortalRoutes = [
  '/portal',
  '/portal/properties',
  '/portal/compliance',
  '/portal/investments',
  '/portal/statements',
  '/tenant-portal',
  '/tenant-portal/rent',
  '/tenant-portal/documents',
  '/tenant-portal/maintenance',
];

test.describe('Portal Route Guards', () => {
  for (const path of protectedPortalRoutes) {
    test(`redirects unauthenticated visitors from ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForURL(/\/auth/);
      await expect(page).toHaveURL(/\/auth/);
    });
  }
});
