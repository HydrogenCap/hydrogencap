#!/usr/bin/env node
// Fails CI if any reference to a dropped V1 table appears in production code.
//
// Dropped V1 tables (replaced by V2 equivalents):
//   loans     → loan_facilities
//   tenancies → tenancy_agreements
//   costs     → property_cost_budgets_v2
//   income    → property_income_budgets_v2
//
// Patterns matched:
//   (a) .from('<table>') / .from("<table>")    — Supabase client calls
//   (b) 'public.<table>' / "public.<table>"    — raw SQL string refs
//
// Allowlist:
//   - src/lib/v1Frozen.ts  (intentional string refs in throw-guard messages)
//
// Scopes scanned: src/ and supabase/functions/
// (docs/ and *.md files are excluded — they reference table names for documentation.)

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const SCAN_DIRS = ['src', 'supabase/functions'];
const V1_TABLES = ['loans', 'tenancies', 'costs', 'income'];

const ALLOWLIST = new Set([
  'src/lib/v1Frozen.ts',
  'src/__tests__/check-no-v1-table-refs.test.ts',
]);

const PATTERNS = V1_TABLES.flatMap((t) => [
  { table: t, regex: new RegExp(`\\.from\\(\\s*['"\`]${t}['"\`]\\s*\\)`) },
  { table: t, regex: new RegExp(`['"\`]public\\.${t}['"\`]`) },
]);

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const offenders = [];
for (const scanDir of SCAN_DIRS) {
  const absDir = join(root, scanDir);
  try {
    if (!statSync(absDir).isDirectory()) continue;
  } catch {
    continue;
  }
  for (const file of walk(absDir)) {
    const rel = relative(root, file).split(sep).join('/');
    if (ALLOWLIST.has(rel)) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const { table, regex } of PATTERNS) {
        if (regex.test(line)) {
          offenders.push({ file: rel, line: i + 1, table, snippet: line.trim() });
        }
      }
    });
  }
}

if (offenders.length > 0) {
  console.error('\n❌ Disallowed V1 table reference(s) found in production code:');
  for (const o of offenders) {
    console.error(`  - ${o.file}:${o.line}  [${o.table}]  ${o.snippet}`);
  }
  console.error(
    `\nThe V1 tables (loans, tenancies, costs, income) have been dropped. ` +
    `Migrate to the V2 equivalents (loan_facilities, tenancy_agreements, ` +
    `property_cost_budgets_v2, property_income_budgets_v2). ` +
    `If this reference is intentional (e.g. a throw-guard string), add the file ` +
    `to the allowlist in scripts/check-no-v1-table-refs.mjs.\n`,
  );
  process.exit(1);
}

console.log('✓ No V1 table references in src/ or supabase/functions/.');
