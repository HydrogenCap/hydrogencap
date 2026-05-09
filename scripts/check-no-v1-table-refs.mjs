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

// §0b Ship A — write-pattern guard: V1 `compliance_items` and
// `compliance_documents` reads are still allowed (they get redirected via
// a compat layer in Ship C/D), but writes (insert/update/upsert/delete)
// must not appear in production code.
const V1_WRITE_ONLY_TABLES = ['compliance_items', 'compliance_documents'];

const ALLOWLIST = new Set([
  'src/lib/v1Frozen.ts',
  'src/__tests__/check-no-v1-table-refs.test.ts',
]);

// §0b Ship A — the write-guard for compliance_items / compliance_documents
// is staged: Ship A locks the two double-writers (useComplianceIntake +
// process-document). The remaining V1-only writers below are scheduled for
// Ship C (UI hooks) and Ship D (background fns). Each entry points at the
// ship that will remove it.
const WRITE_GUARD_ALLOWLIST = new Set([
  // Ship C — UI hooks (V1 reads + writes redirect via compat layer)
  'src/hooks/useCompliance.ts',
  'src/hooks/useRenewalWorkflow.ts',
  // Ship D — background fns
  'supabase/functions/send-compliance-reminders/index.ts',
]);

const PATTERNS = V1_TABLES.flatMap((t) => [
  { table: t, regex: new RegExp(`\\.from\\(\\s*['"\`]${t}['"\`]\\s*\\)`), kind: 'any' },
  { table: t, regex: new RegExp(`['"\`]public\\.${t}['"\`]`), kind: 'any' },
]);

// Multi-line write patterns for the §0b Ship A guard. We collapse whitespace
// before matching so a chained `.from('compliance_items')\n  .update({...})`
// is caught the same as a one-liner.
const WRITE_PATTERNS = V1_WRITE_ONLY_TABLES.map((t) => ({
  table: t,
  regex: new RegExp(
    `\\.from\\(\\s*['"\`]${t}['"\`]\\s*\\)\\s*\\.\\s*(insert|update|upsert|delete)\\b`,
  ),
  kind: 'write',
}));

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
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');

    // (1) Per-line drop checks for fully-removed V1 tables.
    lines.forEach((line, i) => {
      for (const { table, regex } of PATTERNS) {
        if (regex.test(line)) {
          offenders.push({ file: rel, line: i + 1, table, kind: 'drop', snippet: line.trim() });
        }
      }
    });

    // (2) Whole-file write-pattern checks for V1 tables whose reads are
    // still allowed but whose writes were killed in §0b Ship A.
    const collapsed = content.replace(/\s+/g, ' ');
    if (WRITE_GUARD_ALLOWLIST.has(rel)) {
      // Skip §0b Ship A write-guard for files scheduled for Ship C/D.
    } else for (const { table, regex } of WRITE_PATTERNS) {
      const m = collapsed.match(regex);
      if (m) {
        // Re-locate the offending `.from('<table>')` call in the original
        // text so the error points at a real line number.
        const fromCallRe = new RegExp(`\\.from\\(\\s*['"\`]${table}['"\`]\\s*\\)`, 'g');
        let lineNo = 0;
        let match;
        while ((match = fromCallRe.exec(content)) !== null) {
          lineNo = content.slice(0, match.index).split('\n').length;
          // Look in a small window for the banned write call.
          const window = content.slice(match.index, match.index + 400).replace(/\s+/g, ' ');
          if (regex.test(window)) {
            offenders.push({
              file: rel,
              line: lineNo,
              table,
              kind: 'write',
              snippet: window.slice(0, 120).trim(),
            });
            break;
          }
        }
      }
    }
  }
}

if (offenders.length > 0) {
  console.error('\n❌ Disallowed V1 table reference(s) found in production code:');
  for (const o of offenders) {
    console.error(`  - ${o.file}:${o.line}  [${o.table}/${o.kind}]  ${o.snippet}`);
  }
  console.error(
    `\nDropped V1 tables (loans, tenancies, costs, income) — migrate to V2 ` +
    `(loan_facilities, tenancy_agreements, property_cost_budgets_v2, property_income_budgets_v2).\n` +
    `Frozen V1 writes (compliance_items, compliance_documents) — §0b Ship A killed all ` +
    `insert/update/upsert/delete on these tables. Reads via .select(...) are still allowed; they ` +
    `get redirected via a compat layer in Ship C/D.\n` +
    `If a reference is intentional (e.g. a throw-guard string), add the file to the allowlist ` +
    `in scripts/check-no-v1-table-refs.mjs.\n`,
  );
  process.exit(1);
}

console.log('✓ No V1 table references in src/ or supabase/functions/.');
