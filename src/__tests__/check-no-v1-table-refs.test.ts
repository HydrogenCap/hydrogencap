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

  it('exits 1 when a .sql migration references a §0a dropped V1 table', () => {
    const box = mkdtempSync(join(tmpdir(), 'v1-refs-sql-bad-'));
    mkdirSync(join(box, 'scripts'), { recursive: true });
    mkdirSync(join(box, 'supabase/migrations'), { recursive: true });
    cpSync(SCRIPT_SRC, join(box, 'scripts/check-no-v1-table-refs.mjs'));
    writeFileSync(
      join(box, 'supabase/migrations/20990101000000_bad.sql'),
      'SELECT * FROM loans;\n',
    );
    const r = spawnSync(process.execPath, ['scripts/check-no-v1-table-refs.mjs'], {
      cwd: box, encoding: 'utf8',
    });
    rmSync(box, { recursive: true, force: true });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('loans');
  });

  it('exits 0 when a .sql migration references a §0b table not yet on SQL list', () => {
    const box = mkdtempSync(join(tmpdir(), 'v1-refs-sql-0b-'));
    mkdirSync(join(box, 'scripts'), { recursive: true });
    mkdirSync(join(box, 'supabase/migrations'), { recursive: true });
    cpSync(SCRIPT_SRC, join(box, 'scripts/check-no-v1-table-refs.mjs'));
    writeFileSync(
      join(box, 'supabase/migrations/20990101000001_0b.sql'),
      'SELECT * FROM compliance_items;\n',
    );
    const r = spawnSync(process.execPath, ['scripts/check-no-v1-table-refs.mjs'], {
      cwd: box, encoding: 'utf8',
    });
    rmSync(box, { recursive: true, force: true });
    expect(r.status).toBe(0);
  });

  it('exits 0 when a SQL file with a forbidden ref carries the allowlist marker', () => {
    const box = mkdtempSync(join(tmpdir(), 'v1-refs-sql-marker-'));
    mkdirSync(join(box, 'scripts'), { recursive: true });
    mkdirSync(join(box, 'supabase/migrations'), { recursive: true });
    cpSync(SCRIPT_SRC, join(box, 'scripts/check-no-v1-table-refs.mjs'));
    writeFileSync(
      join(box, 'supabase/migrations/20990101000002_allowed.sql'),
      '-- @allow-v1-refs: historical cleanup\nSELECT * FROM loans;\n',
    );
    const r = spawnSync(process.execPath, ['scripts/check-no-v1-table-refs.mjs'], {
      cwd: box, encoding: 'utf8',
    });
    rmSync(box, { recursive: true, force: true });
    expect(r.status).toBe(0);
  });

  it('does not flag V1 names appearing only inside SQL string literals', () => {
    const box = mkdtempSync(join(tmpdir(), 'v1-refs-sql-strlit-'));
    mkdirSync(join(box, 'scripts'), { recursive: true });
    mkdirSync(join(box, 'supabase/migrations'), { recursive: true });
    cpSync(SCRIPT_SRC, join(box, 'scripts/check-no-v1-table-refs.mjs'));
    writeFileSync(
      join(box, 'supabase/migrations/20990101000003_comment.sql'),
      "COMMENT ON COLUMN public.x.y IS 'excluded from income KPIs';\n",
    );
    const r = spawnSync(process.execPath, ['scripts/check-no-v1-table-refs.mjs'], {
      cwd: box, encoding: 'utf8',
    });
    rmSync(box, { recursive: true, force: true });
    expect(r.status).toBe(0);
  });

  // ===== #104 SQL guard polish trio =====

  function sqlBox(label: string, sql: string) {
    const box = mkdtempSync(join(tmpdir(), `${label}-`));
    mkdirSync(join(box, 'scripts'), { recursive: true });
    mkdirSync(join(box, 'supabase/migrations'), { recursive: true });
    cpSync(SCRIPT_SRC, join(box, 'scripts/check-no-v1-table-refs.mjs'));
    writeFileSync(join(box, 'supabase/migrations/20990201000000_x.sql'), sql);
    const r = spawnSync(process.execPath, ['scripts/check-no-v1-table-refs.mjs'], {
      cwd: box, encoding: 'utf8',
    });
    rmSync(box, { recursive: true, force: true });
    return r;
  }

  it('flags UPDATE form', () => {
    const r = sqlBox('v1-sql-update', "UPDATE public.loans SET x = 1;\n");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('loans');
  });

  it('flags INSERT INTO form', () => {
    const r = sqlBox('v1-sql-insert', "INSERT INTO public.loans (id) VALUES (1);\n");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('loans');
  });

  it('flags DELETE FROM without public. prefix', () => {
    const r = sqlBox('v1-sql-delete', "DELETE FROM loans WHERE id = 1;\n");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('loans');
  });

  it('flags REFERENCES form (FK creation)', () => {
    const r = sqlBox(
      'v1-sql-refs',
      "CREATE TABLE x (tenancy_id uuid REFERENCES public.tenancies(id));\n",
    );
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('tenancies');
  });

  it('flags multi-line FROM clause', () => {
    const r = sqlBox(
      'v1-sql-multiline',
      "SELECT *\nFROM\n  public.loans\nWHERE id = 1;\n",
    );
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('loans');
  });

  it("does not flag refs inside E'...' escape strings with backslash quotes", () => {
    const r = sqlBox(
      'v1-sql-estring',
      "SELECT E'derived from loans \\'metrics\\' table' AS note;\n",
    );
    expect(r.status).toBe(0);
  });

  it('does not flag refs inside untagged dollar-quoted strings', () => {
    const r = sqlBox(
      'v1-sql-dollar',
      "DO $$ BEGIN RAISE NOTICE 'computed FROM loans table'; END $$;\n",
    );
    expect(r.status).toBe(0);
  });

  it('does not flag refs inside tagged dollar-quoted strings', () => {
    const r = sqlBox(
      'v1-sql-dollartag',
      "CREATE FUNCTION f() RETURNS void AS $body$ SELECT 1 FROM loans; $body$ LANGUAGE sql;\n",
    );
    expect(r.status).toBe(0);
  });

  it('does not flag refs inside /* block comments */', () => {
    const r = sqlBox(
      'v1-sql-block',
      "/* migration note: replaces FROM public.loans with loan_facilities */\nSELECT 1;\n",
    );
    expect(r.status).toBe(0);
  });

  it('still flags real refs that follow a stripped string literal on same line', () => {
    const r = sqlBox(
      'v1-sql-mixed',
      "SELECT 'note from income KPIs' AS x, * FROM public.loans;\n",
    );
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('loans');
  });
});
