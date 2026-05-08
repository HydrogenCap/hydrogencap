import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Self-test for scripts/check-no-v1-table-refs.mjs.
// Copies the script into a fresh sandbox repo containing a single offending
// file under src/, runs it, and asserts a non-zero exit + the offending file
// surfaced in stderr.

const REPO_ROOT = process.cwd();
const SCRIPT_SRC = join(REPO_ROOT, 'scripts/check-no-v1-table-refs.mjs');

describe('check-no-v1-table-refs script', () => {
  const sandbox = mkdtempSync(join(tmpdir(), 'v1-refs-test-'));

  afterAll(() => {
    rmSync(sandbox, { recursive: true, force: true });
  });

  it('exits 1 when a forbidden V1 ref is present', () => {
    mkdirSync(join(sandbox, 'scripts'), { recursive: true });
    mkdirSync(join(sandbox, 'src'), { recursive: true });
    cpSync(SCRIPT_SRC, join(sandbox, 'scripts/check-no-v1-table-refs.mjs'));
    writeFileSync(
      join(sandbox, 'src/bad.ts'),
      "supabase.from('loans').select('*');\n",
    );

    const result = spawnSync(
      process.execPath,
      ['scripts/check-no-v1-table-refs.mjs'],
      { cwd: sandbox, encoding: 'utf8' },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('src/bad.ts');
    expect(result.stderr).toContain('loans');
  });

  it('exits 0 on a clean tree', () => {
    const cleanBox = mkdtempSync(join(tmpdir(), 'v1-refs-clean-'));
    mkdirSync(join(cleanBox, 'scripts'), { recursive: true });
    mkdirSync(join(cleanBox, 'src'), { recursive: true });
    cpSync(SCRIPT_SRC, join(cleanBox, 'scripts/check-no-v1-table-refs.mjs'));
    writeFileSync(
      join(cleanBox, 'src/good.ts'),
      "supabase.from('loan_facilities').select('*');\n",
    );

    const result = spawnSync(
      process.execPath,
      ['scripts/check-no-v1-table-refs.mjs'],
      { cwd: cleanBox, encoding: 'utf8' },
    );

    rmSync(cleanBox, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('No V1 table references');
  });
});
