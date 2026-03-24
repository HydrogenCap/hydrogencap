import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const workspaceRoot = process.cwd();
const functionsRoot = join(workspaceRoot, 'supabase', 'functions');

function resolveDenoBinary() {
  if (process.env.DENO_BINARY) {
    return process.env.DENO_BINARY;
  }

  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    const wingetPath = join(
      process.env.LOCALAPPDATA,
      'Microsoft',
      'WinGet',
      'Packages',
      'DenoLand.Deno_Microsoft.Winget.Source_8wekyb3d8bbwe',
      'deno.exe'
    );

    try {
      if (statSync(wingetPath).isFile()) {
        return wingetPath;
      }
    } catch {
      // Fall through to PATH lookup below.
    }
  }

  return 'deno';
}

function listTypeScriptFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return listTypeScriptFiles(fullPath);
    }

    return entry.isFile() && entry.name.endsWith('.ts') ? [fullPath] : [];
  });
}

if (!statSync(functionsRoot).isDirectory()) {
  console.error('Supabase functions directory not found.');
  process.exit(1);
}

const filesToCheck = listTypeScriptFiles(functionsRoot)
  .sort();

const edgeFunctionEntries = filesToCheck.filter((file) => {
  const relativePath = relative(functionsRoot, file);
  return relativePath.startsWith('_shared') || relativePath.endsWith('index.ts');
});
const denoBinary = resolveDenoBinary();

for (const file of edgeFunctionEntries) {
  const result = spawnSync(denoBinary, ['check', file], {
    cwd: workspaceRoot,
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`Checked ${edgeFunctionEntries.length} edge function entry files successfully.`);
