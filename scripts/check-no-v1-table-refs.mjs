#!/usr/bin/env node
// Fails CI if any reference to a dropped V1 table appears in production code.
//
// === Asymmetric scan layers (Option 1, 2026-05-12) ===
//
// TS/JS layer (src/, supabase/functions/**/*.{ts,tsx,js,jsx,mjs,cjs}):
//   Scans for the full V1 list — fully-dropped §0a tables, §0b write-frozen
//   tables, and renamed-away *_v2 names. App code must not touch any of these.
//
// SQL layer (supabase/migrations/**/*.sql, supabase/functions/**/*.sql):
//   Scans ONLY for the 4 fully-dropped §0a tables. §0b tables (properties,
//   rooms, tenants, share_classes, compliance_items, compliance_documents)
//   still live in the DB and are referenced by historical migrations + active
//   RLS/index migrations — flagging them in SQL would force ~89 allowlist
//   markers on legitimate migrations. Each §0b table migrates from the TS
//   list to the SQL list when its Ship F (DROP TABLE public.<v1>) lands.
//
// Per-file allowlist marker:
//   `-- @allow-v1-refs: <reason>` (SQL) or `// @allow-v1-refs: <reason>` (TS)
//   on any line in the file disables this guard for that file. Should rarely
//   be needed for SQL since the 4 dropped tables shouldn't legitimately
//   appear (e.g. a hypothetical "migrate orphaned data" cleanup script
//   could carry the marker if needed).
//
// Dropped V1 tables (§0a — replaced by V2 equivalents, also blocked in SQL):
//   loans     → loan_facilities
//   tenancies → tenancy_agreements
//   costs     → property_cost_budgets
//   income    → property_income_budgets
//
// Renamed-away `*_v2` tables (Partial-#61, 2026-05-09):
//   compliance_contractors_v2  → compliance_contractors
//   compliance_requirements_v2 → compliance_requirements
//   property_cost_budgets_v2   → property_cost_budgets
//   property_income_budgets_v2 → property_income_budgets

import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const SCAN_DIRS_CODE = ['src', 'supabase/functions'];
const SCAN_DIRS_SQL = ['supabase/migrations', 'supabase/functions'];

// Fully-dropped §0a V1 tables — flagged in BOTH TS and SQL layers.
const V1_TABLES = ['loans', 'tenancies', 'costs', 'income'];

// SQL layer flags ONLY the §0a fully-dropped tables. See header for rationale.
const SQL_FULLY_DROPPED_V1_TABLES = ['loans', 'tenancies', 'costs', 'income'];

// §0b Ship A — write-pattern guard: V1 reads are still allowed (they get
// redirected via a compat layer / Ship C), but writes (insert/update/upsert/
// delete) must not appear in production TS code.
const V1_WRITE_ONLY_TABLES = ['compliance_items', 'compliance_documents', 'properties'];

const ALLOWLIST = new Set([
  'src/lib/v1Frozen.ts',
  'src/__tests__/check-no-v1-table-refs.test.ts',
]);

// §0b Ship A — write-guard staging allowlist (TS only).
const WRITE_GUARD_ALLOWLIST = new Set([
  'src/hooks/useCompliance.ts',
  'src/hooks/useRenewalWorkflow.ts',
  'src/hooks/useCompanies.ts',
  'supabase/functions/send-compliance-reminders/index.ts',
]);

// Renamed-away V2 names + V1 `rooms` redirect (TS-only guard).
const RENAMED_V2_TABLES = [
  'compliance_contractors_v2',
  'compliance_requirements_v2',
  'property_cost_budgets_v2',
  'property_income_budgets_v2',
  'rooms',
];

// === TS/JS pattern set ===
const TS_PATTERNS = [
  ...V1_TABLES.flatMap((t) => [
    { table: t, regex: new RegExp(`\\.from\\(\\s*['"\`]${t}['"\`]\\s*\\)`), kind: 'drop' },
    { table: t, regex: new RegExp(`['"\`]public\\.${t}['"\`]`), kind: 'drop' },
  ]),
  ...RENAMED_V2_TABLES.flatMap((t) => [
    { table: t, regex: new RegExp(`\\.from\\(\\s*['"\`]${t}['"\`]\\s*\\)`), kind: 'renamed' },
    { table: t, regex: new RegExp(`['"\`]public\\.${t}['"\`]`), kind: 'renamed' },
  ]),
];

const TS_WRITE_PATTERNS = V1_WRITE_ONLY_TABLES.map((t) => ({
  table: t,
  regex: new RegExp(
    `\\.from\\(\\s*['"\`]${t}['"\`]\\s*\\)\\s*\\.\\s*(insert|update|upsert|delete)\\b`,
  ),
  kind: 'write',
}));

// === SQL pattern set ===
// Matches FROM/UPDATE/INSERT INTO/DELETE FROM/REFERENCES/JOIN, optionally
// with `public.` schema qualifier, requiring a word boundary so e.g.
// `loans_v2` or `incoming` don't match. `\s+` matches newlines, so
// multi-line statements like `FROM\n  public.loans` are handled when the
// pattern is run against the whole (stripped) file content.
const SQL_PATTERNS = SQL_FULLY_DROPPED_V1_TABLES.flatMap((t) => [
  {
    table: t,
    regex: new RegExp(
      `\\b(?:FROM|UPDATE|INSERT\\s+INTO|DELETE\\s+FROM|REFERENCES|JOIN)\\s+(?:public\\.)?${t}\\b`,
      'gi',
    ),
    kind: 'sql-drop',
  },
]);

const ALLOW_MARKER = /@allow-v1-refs:/;

// Strip SQL "noise" — comments and string literals — replacing each char
// with a space (newlines preserved) so byte offsets and line numbers in
// the stripped content match the original. Handles:
//   - line comments:    -- ...
//   - block comments:   /* ... */ (nested-aware)
//   - single quotes:    '...'  (doubled '' escape)
//   - escape strings:   E'...' (backslash escapes + doubled '')
//   - dollar quotes:    $$...$$  and  $tag$...$tag$
function stripSqlNoise(s) {
  let out = '';
  let i = 0;
  const blank = (span) => span.replace(/[^\n]/g, ' ');
  while (i < s.length) {
    const c = s[i];
    const c2 = s[i + 1];
    if (c === '/' && c2 === '*') {
      let depth = 1, j = i + 2;
      while (j < s.length && depth > 0) {
        if (s[j] === '/' && s[j + 1] === '*') { depth++; j += 2; }
        else if (s[j] === '*' && s[j + 1] === '/') { depth--; j += 2; }
        else j++;
      }
      out += blank(s.slice(i, j)); i = j; continue;
    }
    if (c === '-' && c2 === '-') {
      let j = i;
      while (j < s.length && s[j] !== '\n') j++;
      out += blank(s.slice(i, j)); i = j; continue;
    }
    if (c === '$') {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(s.slice(i));
      if (m) {
        const tag = m[0];
        const end = s.indexOf(tag, i + tag.length);
        const j = end === -1 ? s.length : end + tag.length;
        out += blank(s.slice(i, j)); i = j; continue;
      }
    }
    if ((c === 'E' || c === 'e') && c2 === "'") {
      let j = i + 2;
      while (j < s.length) {
        if (s[j] === '\\' && j + 1 < s.length) { j += 2; continue; }
        if (s[j] === "'") {
          if (s[j + 1] === "'") { j += 2; continue; }
          j++; break;
        }
        j++;
      }
      out += blank(s.slice(i, j)); i = j; continue;
    }
    if (c === "'") {
      let j = i + 1;
      while (j < s.length) {
        if (s[j] === "'") {
          if (s[j + 1] === "'") { j += 2; continue; }
          j++; break;
        }
        j++;
      }
      out += blank(s.slice(i, j)); i = j; continue;
    }
    out += c; i++;
  }
  return out;
}

function scanSqlContent(content) {
  const stripped = stripSqlNoise(content);
  const hits = [];
  const origLines = content.split('\n');
  for (const { table, regex, kind } of SQL_PATTERNS) {
    regex.lastIndex = 0;
    let m;
    while ((m = regex.exec(stripped)) !== null) {
      const lineNo = stripped.slice(0, m.index).split('\n').length;
      hits.push({
        line: lineNo,
        table,
        kind,
        snippet: (origLines[lineNo - 1] ?? '').trim(),
      });
    }
  }
  return hits;
}

function walk(dir, exts) {
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
      out.push(...walk(full, exts));
    } else if (exts.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const offenders = [];

// --- TS/JS scan ---
for (const scanDir of SCAN_DIRS_CODE) {
  const absDir = join(root, scanDir);
  try {
    if (!statSync(absDir).isDirectory()) continue;
  } catch {
    continue;
  }
  for (const file of walk(absDir, /\.(ts|tsx|js|jsx|mjs|cjs)$/)) {
    const rel = relative(root, file).split(sep).join('/');
    if (ALLOWLIST.has(rel)) continue;
    const content = readFileSync(file, 'utf8');
    if (ALLOW_MARKER.test(content)) continue;
    const lines = content.split('\n');

    lines.forEach((line, i) => {
      for (const { table, regex, kind } of TS_PATTERNS) {
        if (regex.test(line)) {
          offenders.push({ file: rel, line: i + 1, table, kind, snippet: line.trim() });
        }
      }
    });

    const collapsed = content.replace(/\s+/g, ' ');
    if (WRITE_GUARD_ALLOWLIST.has(rel)) {
      // Skip §0b Ship A write-guard for files scheduled for Ship C/D.
    } else for (const { table, regex } of TS_WRITE_PATTERNS) {
      const m = collapsed.match(regex);
      if (m) {
        const fromCallRe = new RegExp(`\\.from\\(\\s*['"\`]${table}['"\`]\\s*\\)`, 'g');
        let lineNo = 0;
        let match;
        while ((match = fromCallRe.exec(content)) !== null) {
          lineNo = content.slice(0, match.index).split('\n').length;
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

// --- SQL scan ---
const sqlSeen = new Set();
for (const scanDir of SCAN_DIRS_SQL) {
  const absDir = join(root, scanDir);
  try {
    if (!statSync(absDir).isDirectory()) continue;
  } catch {
    continue;
  }
  for (const file of walk(absDir, /\.sql$/)) {
    if (sqlSeen.has(file)) continue;
    sqlSeen.add(file);
    const rel = relative(root, file).split(sep).join('/');
    const content = readFileSync(file, 'utf8');
    if (ALLOW_MARKER.test(content)) continue;
    for (const hit of scanSqlContent(content)) {
      offenders.push({ file: rel, ...hit });
    }
  }
}

if (offenders.length > 0) {
  console.error('\n❌ Disallowed V1 table reference(s) found:');
  for (const o of offenders) {
    console.error(`  - ${o.file}:${o.line}  [${o.table}/${o.kind}]  ${o.snippet}`);
  }
  console.error(
    `\nDropped V1 tables (loans, tenancies, costs, income) — migrate to V2 ` +
    `(loan_facilities, tenancy_agreements, property_cost_budgets, property_income_budgets).\n` +
    `Renamed-away V2 tables (Partial-#61, 2026-05-09): use the canonical names ` +
    `(compliance_contractors, compliance_requirements, property_cost_budgets, property_income_budgets) — ` +
    `the *_v2 names no longer exist in the database.\n` +
    `Frozen V1 writes (compliance_items, compliance_documents, properties) — §0b Ship A killed all ` +
    `insert/update/upsert/delete on these tables. Reads via .select(...) are still allowed.\n` +
    `SQL layer flags ONLY the 4 fully-dropped §0a tables. §0b tables migrate to the SQL list as their ` +
    `Ship F lands.\n` +
    `If a reference is intentional (e.g. a one-off cleanup migration), add a ` +
    `\`-- @allow-v1-refs: <reason>\` (SQL) or \`// @allow-v1-refs: <reason>\` (TS) marker to the file.\n`,
  );
  process.exit(1);
}

console.log('✓ No V1 table references in src/, supabase/functions/, or supabase/migrations/.');
