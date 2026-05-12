import { describe, it, expect, afterAll, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  mkdirSync,
  cpSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Self-test for scripts/check-freeze-trigger-coverage.mjs.
// Stages a sandbox project root with a fake supabase/migrations tree + config
// file and asserts the script's exit code matches the expected drift state.

const REPO_ROOT = process.cwd();
const SCRIPT_SRC = join(REPO_ROOT, 'scripts/check-freeze-trigger-coverage.mjs');

function setupSandbox(label: string) {
  const sandbox = mkdtempSync(join(tmpdir(), `${label}-`));
  mkdirSync(join(sandbox, 'scripts'), { recursive: true });
  mkdirSync(join(sandbox, 'supabase/migrations'), { recursive: true });
  cpSync(SCRIPT_SRC, join(sandbox, 'scripts/check-freeze-trigger-coverage.mjs'));
  return sandbox;
}

function run(cwd: string) {
  return spawnSync(
    process.execPath,
    ['scripts/check-freeze-trigger-coverage.mjs'],
    { cwd, encoding: 'utf8' },
  );
}

const CONFIG_MATCHING_CLEAN_TREE = {
  expected_installed: [
    { table: 'properties', reason: 'seed' },
    { table: 'rooms', reason: 'seed' },
    { table: 'tenants', reason: 'seed' },
  ],
  pending_install: [
    { table: 'share_classes', reason: 'pending' },
    { table: 'compliance_items', reason: 'pending' },
    { table: 'compliance_documents', reason: 'pending' },
  ],
};

describe('check-freeze-trigger-coverage script', () => {
  const sandboxes: string[] = [];

  afterAll(() => {
    for (const s of sandboxes) rmSync(s, { recursive: true, force: true });
  });

  it('exits 0 when migration final state matches config', () => {
    const sb = setupSandbox('freeze-clean');
    sandboxes.push(sb);

    // Single seed migration installs guard on properties/rooms/tenants via
    // the FOREACH ARRAY pattern.
    writeFileSync(
      join(sb, 'supabase/migrations/20260101000000_seed.sql'),
      `DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['properties', 'rooms', 'tenants']
  LOOP
    EXECUTE format('CREATE TRIGGER v1_freeze_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.v1_freeze_guard()', tbl);
  END LOOP;
END $$;
`,
    );
    writeFileSync(
      join(sb, 'scripts/v1-freeze-trigger-config.json'),
      JSON.stringify(CONFIG_MATCHING_CLEAN_TREE),
    );

    const result = run(sb);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('matches config');
  });

  it('exits 1 when an unexpected install+drop pair drifts a §0b table', () => {
    const sb = setupSandbox('freeze-drift');
    sandboxes.push(sb);

    // Seed installs on the 3 expected tables. A later migration mistakenly
    // installs the guard on share_classes (which the config still lists as
    // pending_install) and a third drops it again. Final state for
    // share_classes = 'dropped', BUT the install in between contradicts
    // pending_install and should be caught — even after the drop, our
    // assertion is that pending tables must NOT have a final 'installed'
    // state. Here final is 'dropped', so we need an actual mismatch case.
    //
    // Use a scenario where the script unambiguously fails: install on
    // share_classes with no subsequent drop.
    writeFileSync(
      join(sb, 'supabase/migrations/20260101000000_seed.sql'),
      `DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['properties', 'rooms', 'tenants']
  LOOP
    EXECUTE format('CREATE TRIGGER v1_freeze_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.v1_freeze_guard()', tbl);
  END LOOP;
END $$;
`,
    );
    writeFileSync(
      join(sb, 'supabase/migrations/20260201000000_unexpected_install.sql'),
      `CREATE TRIGGER v1_freeze_guard BEFORE INSERT OR UPDATE OR DELETE ON public.share_classes FOR EACH ROW EXECUTE FUNCTION public.v1_freeze_guard();
`,
    );
    writeFileSync(
      join(sb, 'scripts/v1-freeze-trigger-config.json'),
      JSON.stringify(CONFIG_MATCHING_CLEAN_TREE),
    );

    const result = run(sb);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('share_classes');
    expect(result.stderr).toContain('drift');
  });

  it('exits 1 when an expected_installed table is dropped', () => {
    const sb = setupSandbox('freeze-dropped');
    sandboxes.push(sb);

    writeFileSync(
      join(sb, 'supabase/migrations/20260101000000_seed.sql'),
      `DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['properties', 'rooms', 'tenants']
  LOOP
    EXECUTE format('CREATE TRIGGER v1_freeze_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.v1_freeze_guard()', tbl);
  END LOOP;
END $$;
`,
    );
    writeFileSync(
      join(sb, 'supabase/migrations/20260301000000_drop_properties.sql'),
      `DROP TRIGGER IF EXISTS v1_freeze_guard ON public.properties;
`,
    );
    writeFileSync(
      join(sb, 'scripts/v1-freeze-trigger-config.json'),
      JSON.stringify(CONFIG_MATCHING_CLEAN_TREE),
    );

    const result = run(sb);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('properties');
  });
});

// ===== DB-query mode (#107) =====
// Exercises mainDb() directly with an injected mock executor so we don't
// need a real Postgres connection in CI.
describe('check-freeze-trigger-coverage --mode=db', () => {
  it('exits 0 when mock pg_trigger state matches config', async () => {
    const mod = await import('../../scripts/check-freeze-trigger-coverage.mjs');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`__exit_${code}__`);
    }) as never);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await mod.mainDb({
        executor: async () => [
          { table_name: 'properties' },
          { table_name: 'rooms' },
          { table_name: 'tenants' },
        ],
      });
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('DB-query coverage matches config'),
      );
    } finally {
      exitSpy.mockRestore();
      logSpy.mockRestore();
      errSpy.mockRestore();
    }
  });

  it('exits 1 when DB has trigger on a pending table (drift)', async () => {
    const mod = await import('../../scripts/check-freeze-trigger-coverage.mjs');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`__exit_${code}__`);
    }) as never);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(
        mod.mainDb({
          executor: async () => [
            { table_name: 'properties' },
            { table_name: 'rooms' },
            { table_name: 'tenants' },
            { table_name: 'share_classes' }, // pending → unexpected install
          ],
        }),
      ).rejects.toThrow('__exit_1__');
      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining('drift detected'),
      );
    } finally {
      exitSpy.mockRestore();
      errSpy.mockRestore();
    }
  });

  it('exits 1 when DB is missing an expected install', async () => {
    const mod = await import('../../scripts/check-freeze-trigger-coverage.mjs');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`__exit_${code}__`);
    }) as never);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(
        mod.mainDb({
          executor: async () => [
            { table_name: 'properties' },
            { table_name: 'rooms' },
            // 'tenants' missing
          ],
        }),
      ).rejects.toThrow('__exit_1__');
      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining('tenants'),
      );
    } finally {
      exitSpy.mockRestore();
      errSpy.mockRestore();
    }
  });
});
