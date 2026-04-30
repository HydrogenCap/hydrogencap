/**
 * postgrest-embed-safety.test.ts
 *
 * Why this exists
 * ---------------
 * On 2026-04-30 the Class-A FK re-point (Prompt #29) added a second FK from
 * `properties_v2` to `legal_entities`. PostgREST resource embedding cannot
 * disambiguate when two FKs link the same parent and child table, so every
 * `.select('legal_entities(...)')` call started failing at runtime with:
 *
 *   "Could not embed because more than one relationship was found
 *    for properties_v2 and legal_entities"
 *
 * `/properties-v2` errored and `/dashboard` showed 0 properties. Hot-fixed in
 * Prompt #30 by rewriting embeds to use the disambiguating syntax
 *   <embedded>!<column_name>(...)   e.g. legal_entities!entity_id(...)
 *   <embedded>!<constraint_name>(...) e.g. legal_entities!properties_v2_entity_id_fkey(...)
 *
 * This test catches the same regression class at CI time before it reaches
 * preview. For every (parent, child) pair with ≥2 FKs in the live schema
 * (snapshotted in fixtures/postgrest-fk-ambiguity.json), it scans every
 * `.select(...)` template literal in src/ and asserts that any embed of the
 * child table from a query against the parent table uses the disambiguating
 * `!` syntax.
 *
 * Refreshing the FK snapshot
 * --------------------------
 * When you add or re-point an FK, re-run this query against the live DB and
 * paste the result into fixtures/postgrest-fk-ambiguity.json:
 *
 *   WITH fks AS (
 *     SELECT cf.relname AS from_table, ct.relname AS to_table,
 *            c.conname  AS constraint_name, af.attname AS from_column
 *     FROM pg_constraint c
 *     JOIN pg_class cf      ON cf.oid = c.conrelid
 *     JOIN pg_namespace nf  ON nf.oid = cf.relnamespace
 *     JOIN pg_class ct      ON ct.oid = c.confrelid
 *     JOIN pg_namespace nt  ON nt.oid = ct.relnamespace
 *     JOIN unnest(c.conkey) WITH ORDINALITY ck(attnum, ord) ON ck.ord = 1
 *     JOIN pg_attribute af  ON af.attrelid = c.conrelid AND af.attnum = ck.attnum
 *     WHERE c.contype = 'f' AND nf.nspname = 'public' AND nt.nspname = 'public'
 *   )
 *   SELECT from_table, to_table, count(*) AS fk_count,
 *          json_agg(json_build_object('constraint', constraint_name,
 *                                     'column', from_column)
 *                   ORDER BY constraint_name) AS constraints
 *   FROM fks
 *   GROUP BY from_table, to_table
 *   HAVING count(*) >= 2
 *   ORDER BY from_table, to_table;
 *
 * Adding a deliberate exception
 * -----------------------------
 * If a specific embed is intentionally bare (e.g. it queries through a view
 * where PostgREST already disambiguates, or via a lateral RPC), add a
 * line-comment immediately above the `.select(` line containing exactly:
 *
 *   // postgrest-embed-safety: allow <parent_table>.<child_table>
 *
 * The test will skip just that pair on that line. Keep allowlist entries
 * narrow — one per ambiguous pair per call site.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ambiguityFixture from './fixtures/postgrest-fk-ambiguity.json' with { type: 'json' };

interface FkConstraint {
  constraint: string;
  column: string;
}
interface AmbiguousPair {
  from_table: string;
  to_table: string;
  constraints: FkConstraint[];
}

const SRC_DIR = join(__dirname, '..');
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx']);
const EXCLUDE_DIRS = new Set([
  '__tests__',
  'test',
  'mocks',
  'integrations', // generated supabase types/client
]);

// ----------------------------------------------------------------------------
// Step 2 — load FK ambiguity graph from snapshot
// ----------------------------------------------------------------------------
const ambiguousPairs: AmbiguousPair[] = ambiguityFixture.ambiguous_pairs;

// Map: parent_table → Map<child_table, AmbiguousPair>
const ambiguityIndex = new Map<string, Map<string, AmbiguousPair>>();
for (const pair of ambiguousPairs) {
  if (!ambiguityIndex.has(pair.from_table)) {
    ambiguityIndex.set(pair.from_table, new Map());
  }
  ambiguityIndex.get(pair.from_table)!.set(pair.to_table, pair);
}

// ----------------------------------------------------------------------------
// File walker
// ----------------------------------------------------------------------------
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry)) continue;
      walk(full, out);
    } else {
      const dot = entry.lastIndexOf('.');
      if (dot === -1) continue;
      const ext = entry.slice(dot);
      if (!SCAN_EXTENSIONS.has(ext)) continue;
      if (entry.endsWith('.test.ts') || entry.endsWith('.test.tsx')) continue;
      if (entry.endsWith('.spec.ts') || entry.endsWith('.spec.tsx')) continue;
      out.push(full);
    }
  }
  return out;
}

// ----------------------------------------------------------------------------
// Step 3 — extract .select(`...`) and .from('parent') context
// ----------------------------------------------------------------------------
interface SelectCall {
  filePath: string;
  startLine: number;
  parentTable: string | null;
  selectBody: string;
  precedingLine: string; // for allowlist comment scan
}

// Match .from('parent_table') ... .select(`...`) within the same chain.
// We're permissive: scan the file, find every .select(`<body>`) and walk
// backwards for the nearest .from('<table>') in the same chain. Chains can
// span lines, so we use a regex on the whole file content with index tracking.
const FROM_RE = /\.from\(\s*['"]([a-zA-Z0-9_]+)['"]\s*\)/g;
const SELECT_BACKTICK_RE = /\.select\(\s*`([^`]*)`/g;
const SELECT_STRING_RE = /\.select\(\s*['"]([^'"]*)['"]/g;

function extractSelects(filePath: string, content: string): SelectCall[] {
  const lines = content.split('\n');
  const selects: SelectCall[] = [];

  // Pre-collect .from(...) positions
  const fromMatches: { index: number; table: string }[] = [];
  let m: RegExpExecArray | null;
  FROM_RE.lastIndex = 0;
  while ((m = FROM_RE.exec(content)) !== null) {
    fromMatches.push({ index: m.index, table: m[1] });
  }

  function findParent(selectIndex: number): string | null {
    // Walk backwards through fromMatches; pick the most recent within ~1500 chars
    // (typical chain length). 1500 is empirical — long enough for multi-line
    // chains, short enough that an unrelated .from() above doesn't bleed in.
    let parent: string | null = null;
    for (const f of fromMatches) {
      if (f.index < selectIndex && selectIndex - f.index < 1500) {
        parent = f.table;
      } else if (f.index >= selectIndex) {
        break;
      }
    }
    return parent;
  }

  function indexToLine(index: number): number {
    let line = 1;
    for (let i = 0; i < index && i < content.length; i++) {
      if (content[i] === '\n') line++;
    }
    return line;
  }

  function pushMatch(re: RegExp): void {
    re.lastIndex = 0;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(content)) !== null) {
      const startLine = indexToLine(mm.index);
      const precedingLine = startLine > 1 ? lines[startLine - 2] : '';
      selects.push({
        filePath,
        startLine,
        parentTable: findParent(mm.index),
        selectBody: mm[1],
        precedingLine,
      });
    }
  }

  pushMatch(SELECT_BACKTICK_RE);
  pushMatch(SELECT_STRING_RE);

  return selects;
}

// ----------------------------------------------------------------------------
// Step 3/4 — parse embed names out of a select body
// ----------------------------------------------------------------------------
// PostgREST embed syntax inside select: `child(col1, col2)` or
// `child!inner(...)`, `child!left(...)`, `child!fk_or_column(...)`.
// We capture the bare embed name AND any disambiguator after `!`.
const EMBED_RE = /([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:!([a-zA-Z_][a-zA-Z0-9_]*))?\s*\(/g;

// PostgREST hints that are NOT disambiguators — they're join-type modifiers.
const JOIN_HINTS = new Set(['inner', 'left']);

interface ParsedEmbed {
  name: string;
  hint: string | null; // text after `!`, if any
}

function parseEmbeds(selectBody: string): ParsedEmbed[] {
  const out: ParsedEmbed[] = [];
  EMBED_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = EMBED_RE.exec(selectBody)) !== null) {
    out.push({ name: m[1], hint: m[2] ?? null });
  }
  return out;
}

function isDisambiguated(embed: ParsedEmbed): boolean {
  if (!embed.hint) return false;
  // `!inner` / `!left` are join-type hints, not disambiguators
  return !JOIN_HINTS.has(embed.hint);
}

// ----------------------------------------------------------------------------
// Allowlist comment parsing
// ----------------------------------------------------------------------------
const ALLOW_RE = /postgrest-embed-safety:\s*allow\s+([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/g;
function isAllowlisted(precedingLine: string, parent: string, child: string): boolean {
  ALLOW_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ALLOW_RE.exec(precedingLine)) !== null) {
    if (m[1] === parent && m[2] === child) return true;
  }
  return false;
}

// ----------------------------------------------------------------------------
// Step 4/5 — assertion
// ----------------------------------------------------------------------------
describe('PostgREST embed safety (Prompt #29 → #30 regression guard)', () => {
  const files = walk(SRC_DIR);

  it('snapshot fixture has loaded', () => {
    expect(ambiguousPairs.length).toBeGreaterThan(0);
  });

  it('no .select() embed of an ambiguous (parent,child) pair is bare', () => {
    let totalEmbeds = 0;
    let totalSelects = 0;
    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      const selects = extractSelects(file, content);
      totalSelects += selects.length;

      for (const sel of selects) {
        if (!sel.parentTable) continue;
        const childMap = ambiguityIndex.get(sel.parentTable);
        if (!childMap) continue;

        const embeds = parseEmbeds(sel.selectBody);
        totalEmbeds += embeds.length;

        for (const embed of embeds) {
          const pair = childMap.get(embed.name);
          if (!pair) continue;
          if (isDisambiguated(embed)) continue;
          if (isAllowlisted(sel.precedingLine, sel.parentTable, embed.name)) continue;

          const rel = relative(process.cwd(), sel.filePath);
          const options = pair.constraints
            .map((c) => `  • ${embed.name}!${c.column}(...)   (column ${c.column}, FK ${c.constraint})`)
            .join('\n');
          violations.push(
            `${rel}:${sel.startLine}\n` +
              `  Parent table: ${sel.parentTable}\n` +
              `  Embedded table: ${embed.name}\n` +
              `  Problem: ${sel.parentTable} has ${pair.constraints.length} FKs to ${embed.name}; ` +
              `bare embed will fail at runtime with PGRST201 ("more than one relationship was found").\n` +
              `  Fix — pick a disambiguator:\n${options}\n` +
              `  Or, if intentional, add a comment immediately above the .select() line:\n` +
              `    // postgrest-embed-safety: allow ${sel.parentTable}.${embed.name}`
          );
        }
      }
    }

    // Expose counters so the failure message and the test summary line up
    // with what the prompt asks the AI to report back.
    if (process.env.POSTGREST_EMBED_SAFETY_VERBOSE) {
      // eslint-disable-next-line no-console
      console.log(
        `[postgrest-embed-safety] scanned ${files.length} files, ` +
          `${totalSelects} .select() calls, ${totalEmbeds} embeds, ` +
          `${ambiguousPairs.length} ambiguous (parent,child) pairs in fixture, ` +
          `${violations.length} violations.`
      );
    }

    if (violations.length > 0) {
      throw new Error(
        `Found ${violations.length} ambiguous PostgREST embed(s) that will ` +
          `fail at runtime with "Could not embed because more than one relationship was found":\n\n` +
          violations.join('\n\n')
      );
    }
  });
});
