#!/usr/bin/env node
// Fails CI if any `eslint-disable.*@typescript-eslint/no-explicit-any` line
// appears in `src/` outside the allowlist.
//
// Allowlist (boilerplate that must keep the disable):
//   - src/components/ui/chart.tsx        (shadcn-generated)
//   - src/integrations/supabase/client.ts (preconfigured client)
//
// Run: node scripts/check-no-explicit-any-disables.mjs

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const srcDir = join(root, 'src');

const ALLOWLIST = new Set([
  'src/components/ui/chart.tsx',
  'src/integrations/supabase/client.ts',
]);

const PATTERN = /eslint-disable(?:-next-line|-line)?[^\\n]*@typescript-eslint\/no-explicit-any/;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
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
for (const file of walk(srcDir)) {
  const rel = relative(root, file).split(sep).join('/');
  if (ALLOWLIST.has(rel)) continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (PATTERN.test(line)) {
      offenders.push(`${rel}:${i + 1}`);
    }
  });
}

if (offenders.length > 0) {
  console.error('\n❌ Disallowed `eslint-disable @typescript-eslint/no-explicit-any` found:');
  for (const o of offenders) console.error(`  - ${o}`);
  console.error(
    `\nFix the underlying type instead of disabling. If the file is genuinely boilerplate, ` +
    `add it to the allowlist in scripts/check-no-explicit-any-disables.mjs.\n`,
  );
  process.exit(1);
}

console.log('✓ No disallowed `no-explicit-any` disables in src/.');
