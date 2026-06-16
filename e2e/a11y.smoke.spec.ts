import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Result } from 'axe-core';
import { hasAuthCredentials, login } from './helpers/auth';
import { writeAxeHtmlReport } from './helpers/axeReport';

/**
 * Axe-core a11y smoke spec — verifies post-#63 contrast pass.
 *
 * Severity policy:
 * - critical / serious: hard fail (zero tolerance).
 * - moderate / minor: fail if count INCREASES vs baseline; warn if it
 *   DECREASES (suggests baseline update via `npm run a11y:update-baseline`).
 * - allowlisted violations (e2e/a11y-allowlist.json) are filtered before
 *   the gate. Allowlist entries with expired `expires_at` fail the build.
 *
 * HTML report per case is written to e2e-results/axe/<UTC-date>/<slug>.html.
 */

const ROUTES: { path: string; name: string; note?: string; public?: boolean }[] = [
  { path: '/dashboard', name: 'dashboard' },
  { path: '/today', name: 'today', note: 'Core flow: Today workspace (WCAG 2.1 AA gate)' },
  { path: '/properties-v2', name: 'properties-v2-list', note: 'Core flow: Properties V2 list' },
  { path: '/properties-v2/b33f02bf-89de-416d-baa7-919a26c9a37e', name: 'property-detail' },
  { path: '/compliance-v2', name: 'compliance-v2', note: 'Core flow: Compliance V2 register' },
  { path: '/auth', name: 'auth', public: true, note: 'Core flow: Auth — scanned logged-out' },
  { path: '/compliance/calendar', name: 'compliance-calendar' },
  { path: '/rent', name: 'rent' },
  // #63b coverage expansion (2026-05-08):
  { path: '/inbox', name: 'inbox', note: 'Inbox page touched by #57b NULL-confidence trapdoor' },
  { path: '/tenants-v2', name: 'tenants-v2' },
  { path: '/jobs-and-works', name: 'jobs-and-works', note: '/jobs is a Navigate redirect to this; test the canonical URL' },
  { path: '/lending', name: 'lending', note: 'Loans landing route post-cutover (no /loans path exists)' },
  { path: '/tax', name: 'tax', note: 'Closest match to TaxDashboard; no /tax-dashboard path exists' },
  { path: '/investors', name: 'investors' },
  { path: '/reports', name: 'reports' },
];

const MODES: ('light' | 'dark')[] = ['light', 'dark'];

const BASELINE_PATH = join(process.cwd(), 'e2e/a11y-baseline.json');
const ALLOWLIST_PATH = join(process.cwd(), 'e2e/a11y-allowlist.json');
const REPORT_DATE = new Date().toISOString().slice(0, 10);
const REPORT_DIR = join(process.cwd(), 'e2e-results', 'axe', REPORT_DATE);
const WRITE_BASELINE = process.env.A11Y_WRITE_BASELINE === '1';

interface BaselineEntry {
  moderate: number;
  minor: number;
}
type Baseline = Record<string, BaselineEntry>;

interface AllowlistEntry {
  rule_id: string;
  selector_pattern: string;
  reason: string;
  expires_at?: string;
}

function loadBaseline(): Baseline {
  try {
    const raw = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Record<string, unknown>;
    const out: Baseline = {};
    for (const [k, v] of Object.entries(raw)) {
      if (k.startsWith('_')) continue;
      if (v && typeof v === 'object' && 'moderate' in v && 'minor' in v) {
        out[k] = { moderate: Number((v as BaselineEntry).moderate), minor: Number((v as BaselineEntry).minor) };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function loadAllowlist(): AllowlistEntry[] {
  try {
    const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8')) as { entries?: AllowlistEntry[] };
    return Array.isArray(raw.entries) ? raw.entries : [];
  } catch {
    return [];
  }
}

function checkAllowlistExpiry(entries: AllowlistEntry[]): string[] {
  const today = new Date().toISOString().slice(0, 10);
  const expired: string[] = [];
  for (const e of entries) {
    if (e.expires_at && e.expires_at < today) {
      expired.push(`${e.rule_id} (${e.selector_pattern}) — expired ${e.expires_at}`);
    }
  }
  return expired;
}

function partitionAllowlisted(violations: Result[], entries: AllowlistEntry[]): { kept: Result[]; suppressed: Result[] } {
  if (entries.length === 0) return { kept: violations, suppressed: [] };
  const kept: Result[] = [];
  const suppressed: Result[] = [];
  for (const v of violations) {
    const matchEntry = entries.find((e) => {
      if (e.rule_id !== v.id) return false;
      let re: RegExp;
      try {
        re = new RegExp(e.selector_pattern);
      } catch {
        return false;
      }
      return v.nodes.every((n) => (n.target ?? []).some((t) => re.test(String(t))));
    });
    (matchEntry ? suppressed : kept).push(v);
  }
  return { kept, suppressed };
}

const baseline = loadBaseline();
const allowlist = loadAllowlist();
const expiredAllowlist = checkAllowlistExpiry(allowlist);
const updatedBaseline: Baseline = WRITE_BASELINE ? { ...baseline } : baseline;

test.describe('A11y smoke (axe-core)', () => {
  test.skip(!hasAuthCredentials(), 'Skipping: E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD not set');

  test.beforeAll(() => {
    if (expiredAllowlist.length > 0) {
      throw new Error(`Stale a11y allowlist entries (expires_at < today). Remove or extend:\n  - ${expiredAllowlist.join('\n  - ')}`);
    }
  });

  test.afterAll(() => {
    if (WRITE_BASELINE) {
      const out = {
        _comment: (JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))._comment as string) ?? '',
        ...updatedBaseline,
      };
      writeFileSync(BASELINE_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');
      console.log(`[a11y] Baseline rewritten at ${BASELINE_PATH}`);
    }
  });

  for (const route of ROUTES) {
    for (const mode of MODES) {
      const key = `${route.name}-${mode}`;
      test(`${route.name} — ${mode} mode has no serious/critical violations`, async ({ page }) => {
        if (!route.public) {
          await login(page);
        }
        await page.addInitScript((m: string) => {
          try {
            localStorage.setItem('tenureiq-theme', m);
          } catch {
            /* ignore */
          }
        }, mode);

        await page.goto(route.path);

        await page.evaluate((m: string) => {
          const root = document.documentElement;
          root.classList.remove('light', 'dark');
          root.classList.add(m);
        }, mode);

        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();

        // HTML report (idempotent dir create; per-file write is parallel-safe)
        try {
          writeAxeHtmlReport(join(REPORT_DIR, `${key}.html`), route.path, mode, results);
        } catch (err) {
          console.warn(`[a11y] failed to write HTML report for ${key}:`, (err as Error).message);
        }

        const { kept, suppressed } = partitionAllowlisted(results.violations, allowlist);
        if (suppressed.length > 0) {
          console.log(
            `[a11y] ${key}: suppressed ${suppressed.length} allowlisted violation(s): ${suppressed.map((v) => v.id).join(', ')}`,
          );
        }

        const bySeverity = {
          critical: kept.filter((v) => v.impact === 'critical'),
          serious: kept.filter((v) => v.impact === 'serious'),
          moderate: kept.filter((v) => v.impact === 'moderate'),
          minor: kept.filter((v) => v.impact === 'minor'),
        };

        console.log(
          `[a11y] ${key}: critical=${bySeverity.critical.length} serious=${bySeverity.serious.length} moderate=${bySeverity.moderate.length} minor=${bySeverity.minor.length}`,
        );

        // Hard gates
        expect(
          bySeverity.critical,
          `Critical a11y violations on ${route.path} (${mode}): ${bySeverity.critical.map((v) => v.id).join(', ')}`,
        ).toEqual([]);
        expect(
          bySeverity.serious,
          `Serious a11y violations on ${route.path} (${mode}): ${bySeverity.serious.map((v) => v.id).join(', ')}`,
        ).toEqual([]);

        // Baseline comparison for moderate/minor
        const actual = { moderate: bySeverity.moderate.length, minor: bySeverity.minor.length };

        if (WRITE_BASELINE) {
          updatedBaseline[key] = actual;
          return;
        }

        const base = baseline[key];
        if (!base) {
          console.warn(
            `[a11y] ${key}: no baseline entry yet — recording actual {moderate:${actual.moderate}, minor:${actual.minor}}. Run \`npm run a11y:update-baseline\` to persist.`,
          );
          return;
        }

        for (const sev of ['moderate', 'minor'] as const) {
          const a = actual[sev];
          const b = base[sev];
          if (a > b) {
            const ids = bySeverity[sev].map((v) => v.id).join(', ');
            throw new Error(
              `[a11y] ${key}: ${sev} count regressed (${b} → ${a}). New rule(s) likely: ${ids}. Fix the violations or — if intentional — run \`npm run a11y:update-baseline\`.`,
            );
          } else if (a < b) {
            console.warn(
              `[a11y] ${key}: ${sev} count IMPROVED (${b} → ${a}) — consider running \`npm run a11y:update-baseline\` to ratchet baseline down.`,
            );
          }
        }
      });
    }
  }
});
