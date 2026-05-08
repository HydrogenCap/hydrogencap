import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { hasAuthCredentials, login } from './helpers/auth';

/**
 * Axe-core a11y smoke spec — verifies post-#63 contrast pass.
 * Asserts zero 'serious' or 'critical' violations on canonical
 * authenticated routes in BOTH light and dark mode.
 * 'minor' / 'moderate' are tracked but not failed (see audit doc).
 */
const ROUTES: { path: string; name: string }[] = [
  { path: '/dashboard', name: 'dashboard' },
  { path: '/compliance/calendar', name: 'compliance-calendar' },
  { path: '/rent', name: 'rent' },
  { path: '/properties-v2/b33f02bf-89de-416d-baa7-919a26c9a37e', name: 'property-detail' },
];

const MODES: ('light' | 'dark')[] = ['light', 'dark'];

test.describe('A11y smoke (axe-core)', () => {
  test.skip(!hasAuthCredentials(), 'Skipping: E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD not set');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const route of ROUTES) {
    for (const mode of MODES) {
      test(`${route.name} — ${mode} mode has no serious/critical violations`, async ({ page }) => {
        // Pre-set theme in localStorage so initial paint matches mode
        await page.addInitScript((m: string) => {
          try {
            localStorage.setItem('tenureiq-theme', m);
          } catch {
            /* ignore */
          }
        }, mode);

        await page.goto(route.path);

        // Force theme class on <html> in case storage init missed
        await page.evaluate((m: string) => {
          const root = document.documentElement;
          root.classList.remove('light', 'dark');
          root.classList.add(m);
        }, mode);

        // Allow async content to settle
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();

        const bySeverity = {
          critical: results.violations.filter((v) => v.impact === 'critical'),
          serious: results.violations.filter((v) => v.impact === 'serious'),
          moderate: results.violations.filter((v) => v.impact === 'moderate'),
          minor: results.violations.filter((v) => v.impact === 'minor'),
        };

        // Log moderate/minor for visibility (tracked, not failed)
        console.log(
          `[a11y] ${route.name} ${mode}: critical=${bySeverity.critical.length} serious=${bySeverity.serious.length} moderate=${bySeverity.moderate.length} minor=${bySeverity.minor.length}`,
        );

        expect(
          bySeverity.critical,
          `Critical a11y violations on ${route.path} (${mode}): ${bySeverity.critical.map((v) => v.id).join(', ')}`,
        ).toEqual([]);
        expect(
          bySeverity.serious,
          `Serious a11y violations on ${route.path} (${mode}): ${bySeverity.serious.map((v) => v.id).join(', ')}`,
        ).toEqual([]);
      });
    }
  }
});
