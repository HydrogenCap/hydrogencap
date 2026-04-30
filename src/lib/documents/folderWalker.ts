/**
 * Recursive folder walker for the Bulk Document Scanner.
 *
 * Browsers expose two non-standard but widely-supported APIs for folder uploads:
 *   1. `<input type="file" webkitdirectory>` — gives Files with `webkitRelativePath`.
 *   2. DataTransfer.items with `webkitGetAsEntry()` — gives FileSystemEntry tree on drop.
 *
 * Both are normalised to `{ file, relativePath }` entries here.
 */

export interface WalkedEntry {
  file: File;
  relativePath: string;
}

/** Read an HTML file input that may have `webkitdirectory` set. */
export function readInputFiles(input: HTMLInputElement): WalkedEntry[] {
  if (!input.files) return [];
  const out: WalkedEntry[] = [];
  for (const file of Array.from(input.files)) {
    // webkitRelativePath is set when the input has `webkitdirectory`.
    const rp = (file as File & { webkitRelativePath?: string }).webkitRelativePath || '';
    out.push({ file, relativePath: rp });
  }
  return out;
}

interface FsFileEntry {
  isFile: true;
  isDirectory: false;
  fullPath: string;
  file: (cb: (f: File) => void, err?: (e: unknown) => void) => void;
}

interface FsDirEntry {
  isFile: false;
  isDirectory: true;
  fullPath: string;
  createReader: () => { readEntries: (cb: (entries: FsAnyEntry[]) => void) => void };
}

type FsAnyEntry = FsFileEntry | FsDirEntry;

function entryToFile(entry: FsFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

function readAllDirEntries(dir: FsDirEntry): Promise<FsAnyEntry[]> {
  return new Promise((resolve) => {
    const reader = dir.createReader();
    const collected: FsAnyEntry[] = [];
    const readBatch = () => {
      reader.readEntries((entries) => {
        if (entries.length === 0) {
          resolve(collected);
          return;
        }
        collected.push(...entries);
        readBatch(); // readEntries returns at most ~100 — must drain.
      });
    };
    readBatch();
  });
}

async function walkEntry(entry: FsAnyEntry, out: WalkedEntry[]): Promise<void> {
  if (entry.isFile) {
    try {
      const file = await entryToFile(entry);
      // Strip the leading "/" from fullPath; treat as relative to drop root.
      const rel = entry.fullPath.replace(/^\//, '');
      out.push({ file, relativePath: rel });
    } catch {
      /* swallow read errors for individual files */
    }
    return;
  }
  if (entry.isDirectory) {
    const children = await readAllDirEntries(entry);
    for (const c of children) {
      await walkEntry(c, out);
    }
  }
}

/**
 * Walk a DataTransferItemList from a drop event, recursively expanding
 * any directories. Falls back to the flat `files` list if the browser
 * doesn't expose `webkitGetAsEntry`.
 */
export async function walkDataTransfer(dt: DataTransfer): Promise<WalkedEntry[]> {
  const out: WalkedEntry[] = [];
  const items = dt.items;
  const supportsEntries = items && items.length > 0 && typeof (items[0] as DataTransferItem & { webkitGetAsEntry?: () => unknown }).webkitGetAsEntry === 'function';

  if (!supportsEntries) {
    for (const f of Array.from(dt.files)) {
      out.push({ file: f, relativePath: '' });
    }
    return out;
  }

  const roots: FsAnyEntry[] = [];
  for (const item of Array.from(items)) {
    const e = (item as DataTransferItem & { webkitGetAsEntry: () => unknown }).webkitGetAsEntry();
    if (e) roots.push(e as unknown as FsAnyEntry);
  }

  for (const root of roots) {
    await walkEntry(root, out);
  }
  return out;
}
