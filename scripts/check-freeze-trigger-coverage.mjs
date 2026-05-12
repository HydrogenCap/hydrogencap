#!/usr/bin/env node
// Static audit of `v1_freeze_guard` trigger coverage across §0b V1 tables.
//
// Why: #99's ground-truth-grep lesson — past §0b ships drifted from memory of
// "which V1 tables have the freeze guard installed". Source of truth lives in
// supabase/migrations/*.sql. We replay them in chronological order, compute
// final install state per §0b table, and assert against
// scripts/v1-freeze-trigger-config.json.
//
// Approach: static parsing.
//   - Trigger name is uniformly `v1_freeze_guard` (#99 confirms naming
//     convention is consistent across all §0b tables — no per-table suffixes).
//   - Two install patterns observed:
//       (1) FOREACH tbl IN ARRAY ARRAY['properties','rooms','tenants'] LOOP
//           ... format('CREATE TRIGGER v1_freeze_guard ... ON public.%I', tbl)
//       (2) DO $$ BEGIN IF NOT EXISTS (...) THEN
//             CREATE TRIGGER v1_freeze_guard ... ON public.<table>
//           END IF; END $$;
//   - Drops are explicit:
//       DROP TRIGGER IF EXISTS v1_freeze_guard ON public.<table>;
//     (the DROP inside a format() template is a precursor to a re-CREATE in
//      the same loop; we ignore format()-wrapped drops by requiring a literal
//      `public.<word>` match, which `public.%I` can't satisfy.)
//
// If a future migration installs the trigger via a plpgsql DO block whose
// CREATE TRIGGER body is hidden inside a format() template OUTSIDE the known
// FOREACH ARRAY pattern, this script will silently miss it. Add a new
// detection branch here (or fall back to the DB-query Option B) when that
// happens.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const MIGRATIONS_DIR = join(root, 'supabase/migrations');
const CONFIG_PATH = join(root, 'scripts/v1-freeze-trigger-config.json');

const SECTION_0B_TABLES = [
  'properties',
  'rooms',
  'tenants',
  'share_classes',
  'compliance_items',
  'compliance_documents',
];

function loadConfig() {
  const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  const expected = (raw.expected_installed ?? []).map((e) => e.table);
  const pending = (raw.pending_install ?? []).map((e) => e.table);
  return { expected, pending };
}

function listMigrations() {
  let entries;
  try {
    entries = readdirSync(MIGRATIONS_DIR);
  } catch {
    return [];
  }
  return entries
    .filter((f) => f.endsWith('.sql'))
    .sort() // chronological — filenames begin with YYYYMMDDHHMMSS
    .map((f) => join(MIGRATIONS_DIR, f));
}

// Returns { installs: Set<string>, drops: Set<string> } for one file.
function parseFile(content) {
  const installs = new Set();
  const drops = new Set();

  // (1) FOREACH ARRAY install loop. Detect when the loop body contains a
  //     CREATE TRIGGER v1_freeze_guard format() template.
  const arrayLoopRe =
    /FOREACH\s+\w+\s+IN\s+ARRAY\s+ARRAY\[([^\]]+)\]([\s\S]*?)END\s+LOOP/gi;
  let m;
  while ((m = arrayLoopRe.exec(content)) !== null) {
    const body = m[2];
    if (/CREATE\s+TRIGGER\s+v1_freeze_guard/i.test(body)) {
      const tableLits = m[1].match(/'([^']+)'/g) ?? [];
      for (const lit of tableLits) {
        installs.add(lit.replace(/'/g, ''));
      }
    }
  }

  // (2) Direct CREATE TRIGGER v1_freeze_guard ... ON public.<table>
  //     The format() template uses `public.%I` so it won't match `\w+`.
  const createRe =
    /CREATE\s+TRIGGER\s+v1_freeze_guard\b[\s\S]{0,400}?ON\s+public\.(\w+)/gi;
  while ((m = createRe.exec(content)) !== null) {
    installs.add(m[1]);
  }

  // (3) Explicit DROP TRIGGER IF EXISTS v1_freeze_guard ON public.<table>
  //     Same `public.\w+` literal requirement excludes format()-wrapped drops.
  const dropRe =
    /DROP\s+TRIGGER\s+IF\s+EXISTS\s+v1_freeze_guard\s+ON\s+public\.(\w+)/gi;
  while ((m = dropRe.exec(content)) !== null) {
    drops.add(m[1]);
  }

  // A drop+create pair in the SAME file (e.g. seed migration's DROP-then-
  // CREATE inside the loop, though that path is format()-wrapped and already
  // excluded above) is treated as a net install.
  for (const t of installs) drops.delete(t);

  return { installs, drops };
}

function computeFinalState(migrations) {
  // table -> { state: 'installed' | 'dropped', file: string }
  const state = new Map();
  const trace = []; // { file, table, op }
  for (const file of migrations) {
    const content = readFileSync(file, 'utf8');
    const { installs, drops } = parseFile(content);
    const rel = relative(root, file).split(sep).join('/');
    for (const t of installs) {
      state.set(t, { state: 'installed', file: rel });
      trace.push({ file: rel, table: t, op: 'install' });
    }
    for (const t of drops) {
      state.set(t, { state: 'dropped', file: rel });
      trace.push({ file: rel, table: t, op: 'drop' });
    }
  }
  return { state, trace };
}

function main() {
  const { expected, pending } = loadConfig();
  const allConfigured = new Set([...expected, ...pending]);

  // Sanity: config must cover every §0b table exactly once.
  for (const t of SECTION_0B_TABLES) {
    if (!allConfigured.has(t)) {
      console.error(
        `❌ §0b table '${t}' is missing from scripts/v1-freeze-trigger-config.json. ` +
          `Add it to expected_installed or pending_install with a reason.`,
      );
      process.exit(1);
    }
  }
  for (const t of allConfigured) {
    if (!SECTION_0B_TABLES.includes(t)) {
      console.error(
        `❌ Config table '${t}' is not in the §0b set ` +
          `(${SECTION_0B_TABLES.join(', ')}).`,
      );
      process.exit(1);
    }
  }
  const dupCheck = new Set();
  for (const t of [...expected, ...pending]) {
    if (dupCheck.has(t)) {
      console.error(
        `❌ Config table '${t}' appears in both expected_installed and pending_install.`,
      );
      process.exit(1);
    }
    dupCheck.add(t);
  }

  const migrations = listMigrations();
  const { state } = computeFinalState(migrations);

  const failures = [];
  for (const t of expected) {
    const s = state.get(t);
    if (!s || s.state !== 'installed') {
      failures.push(
        `expected '${t}' to have v1_freeze_guard installed, but final migration state is ` +
          `'${s ? s.state : 'absent'}'${s ? ` (last touched in ${s.file})` : ''}.`,
      );
    }
  }
  for (const t of pending) {
    const s = state.get(t);
    if (s && s.state === 'installed') {
      failures.push(
        `pending table '${t}' has v1_freeze_guard installed in ${s.file} — ` +
          `move it from pending_install to expected_installed in scripts/v1-freeze-trigger-config.json.`,
      );
    }
  }

  // Surface unexpected installs/drops that touch §0b tables outside the
  // configured intent (e.g. someone dropped the guard on 'properties').
  for (const t of SECTION_0B_TABLES) {
    const s = state.get(t);
    if (!s) continue;
    if (expected.includes(t) && s.state === 'dropped') {
      failures.push(
        `§0b table '${t}' had v1_freeze_guard DROPPED in ${s.file} — ` +
          `this contradicts expected_installed.`,
      );
    }
  }

  if (failures.length > 0) {
    console.error('\n❌ v1_freeze_guard trigger coverage drift detected:');
    for (const f of failures) console.error(`  - ${f}`);
    console.error(
      '\nReconcile scripts/v1-freeze-trigger-config.json with the migration history, or ' +
        'land a migration that brings the DB back in line.\n',
    );
    process.exit(1);
  }

  console.log(
    `✓ v1_freeze_guard coverage matches config across ${SECTION_0B_TABLES.length} §0b tables ` +
      `(installed: ${expected.length}, pending: ${pending.length}).`,
  );
}

// === DB-query fallback (#107) ===
//
// Opt-in via `--mode=db` or `--db`. Defensive escape hatch for the case
// where a future migration installs the trigger via a path the static
// parser can't see (format()-wrapped CREATE TRIGGER outside the known
// FOREACH ARRAY pattern, dynamic SQL, etc.). Queries pg_trigger directly.
//
// Connection: requires SUPABASE_DB_URL (libpq URL) and a working `psql`
// on PATH. If only SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are present,
// we surface a clear error — the SRK path would require a pre-installed
// RPC against pg_catalog, which we don't ship by default.
//
// Exit semantics match the static path:
//   0 → DB state matches config
//   1 → drift (missing install, install on a 'pending' table, or
//        an installed table the config doesn't list at all)
import { spawnSync } from 'node:child_process';

async function queryDbState(executor) {
  // executor: ({ sql }) => Promise<Array<{ table_name: string }>>
  const sql =
    `SELECT c.relname AS table_name FROM pg_trigger t ` +
    `JOIN pg_class c ON c.oid = t.tgrelid ` +
    `JOIN pg_namespace n ON n.oid = c.relnamespace ` +
    `WHERE t.tgname = 'v1_freeze_guard' AND NOT t.tgisinternal AND n.nspname = 'public';`;
  const rows = await executor({ sql });
  return new Set(rows.map((r) => r.table_name));
}

function defaultPsqlExecutor({ sql }) {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        'DB-query fallback requires SUPABASE_DB_URL (libpq URL). The ' +
          'SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY combination would need a ' +
          'pre-installed pg_catalog RPC, which is not shipped. Set SUPABASE_DB_URL ' +
          'and retry.',
      );
    }
    throw new Error(
      'DB-query fallback requires SUPABASE_DB_URL env var (libpq connection string).',
    );
  }
  const r = spawnSync('psql', [url, '-At', '-F', '\t', '-c', sql], {
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    throw new Error(`psql failed (exit ${r.status}): ${r.stderr || r.stdout}`);
  }
  return r.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((table_name) => ({ table_name }));
}

async function mainDb({ executor = defaultPsqlExecutor } = {}) {
  const { expected, pending } = loadConfig();
  const installed = await queryDbState(executor);

  const failures = [];
  for (const t of expected) {
    if (!installed.has(t)) {
      failures.push(
        `expected '${t}' to have v1_freeze_guard installed in DB, but pg_trigger has no row.`,
      );
    }
  }
  for (const t of pending) {
    if (installed.has(t)) {
      failures.push(
        `pending table '${t}' has v1_freeze_guard installed in DB — ` +
          `move it from pending_install to expected_installed.`,
      );
    }
  }
  for (const t of installed) {
    if (!expected.includes(t) && !pending.includes(t)) {
      failures.push(
        `DB has v1_freeze_guard on unconfigured table '${t}' — add it to ` +
          `scripts/v1-freeze-trigger-config.json (or remove the trigger).`,
      );
    }
  }

  if (failures.length > 0) {
    console.error('\n❌ v1_freeze_guard DB-query coverage drift detected:');
    for (const f of failures) console.error(`  - ${f}`);
    console.error('');
    process.exit(1);
  }

  console.log(
    `✓ v1_freeze_guard DB-query coverage matches config ` +
      `(installed in DB: ${installed.size}, expected: ${expected.length}).`,
  );
}

const isMain = (() => {
  try {
    return statSync(process.argv[1]).isFile() &&
      process.argv[1].endsWith('check-freeze-trigger-coverage.mjs');
  } catch {
    return false;
  }
})();

if (isMain) {
  const args = process.argv.slice(2);
  const dbMode = args.includes('--db') || args.includes('--mode=db');
  if (dbMode) {
    mainDb().catch((err) => {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    });
  } else {
    main();
  }
}

export { parseFile, computeFinalState, queryDbState, mainDb };
