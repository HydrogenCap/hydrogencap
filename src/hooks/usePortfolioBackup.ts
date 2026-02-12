import { useState, useRef, useCallback } from 'react';
import JSZip from 'jszip';

import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { BACKUP_TABLES, formatBytes, type TableExportConfig } from '@/lib/backupConfig';

// ─── Types ───────────────────────────────────────────────────────

export type BackupPhase =
  | 'idle'
  | 'exporting-data'
  | 'downloading-files'
  | 'building-zip'
  | 'complete'
  | 'error';

export interface BackupProgress {
  phase: BackupPhase;
  currentStep: string;
  completed: number;
  total: number;
  overallPercent: number;
  tableCount: number;
  recordCount: number;
  fileCount: number;
  fileSizeBytes: number;
  warnings: string[];
}

interface FileIndexEntry {
  originalUrl: string;
  zipPath: string;
  table: string;
  recordId: string;
  bucket: string;
  sizeBytes: number;
}

// ─── Helpers ─────────────────────────────────────────────────────

function extractStoragePath(fileUrl: string, bucket: string): string | null {
  try {
    const url = fileUrl.startsWith('http') ? fileUrl : `https://placeholder${fileUrl}`;
    const patterns = [
      new RegExp(`/storage/v1/object/(?:public|sign)/${bucket}/(.+?)(?:\\?|$)`),
      new RegExp(`${bucket}/(.+?)(?:\\?|$)`),
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match?.[1]) return decodeURIComponent(match[1]);
    }
  } catch {
    // URL parsing failed
  }
  return null;
}

function generateSummaryMarkdown(
  manifest: Record<string, any>,
  tableSummary: Array<{ table: string; count: number }>,
  warnings: string[],
): string {
  const lines: string[] = [
    '# HydrogenCap Portfolio Backup',
    '',
    `**Generated:** ${manifest.createdAt}`,
    `**Format version:** ${manifest.version}`,
    `**Mode:** ${manifest.essentialOnly ? 'Essential tables only' : 'Full export'}`,
    `**Files included:** ${manifest.includesFiles ? 'Yes' : 'No'}`,
    '',
    '## Contents',
    '',
    `- **${manifest.totalRecords.toLocaleString()}** records across **${tableSummary.length}** tables`,
    `- **${manifest.totalFiles.toLocaleString()}** files (${formatBytes(manifest.totalFileSizeBytes)})`,
    '',
    '## Data Tables',
    '',
    '| # | Table | Records |',
    '|---|-------|---------|',
  ];

  for (const t of tableSummary) {
    lines.push(`| ${tableSummary.indexOf(t) + 1} | ${t.table} | ${t.count.toLocaleString()} |`);
  }

  if (warnings.length > 0) {
    lines.push('', '## Warnings', '');
    for (const w of warnings) {
      lines.push(`- ${w}`);
    }
  }

  lines.push(
    '',
    '## Restore Instructions',
    '',
    'To restore this backup into a fresh HydrogenCap instance:',
    '',
    '1. Create a new organisation in the target instance.',
    '2. Import the JSON files from `data/` **in numerical order** (00, 01, 02 …).',
    '3. For each file, insert records preserving the original UUIDs.',
    '4. Replace every `org_id` value with the new organisation\'s ID.',
    '5. Upload files from `files/` to the matching storage buckets.',
    '6. Update `file_url` columns in the imported records to point to the new storage URLs.',
    '',
    '> Foreign key relationships are preserved via UUIDs.',
    '> Importing in numerical order satisfies all constraints.',
    '',
  );

  return lines.join('\n');
}

// ─── Hook ────────────────────────────────────────────────────────

const INITIAL_PROGRESS: BackupProgress = {
  phase: 'idle',
  currentStep: '',
  completed: 0,
  total: 0,
  overallPercent: 0,
  tableCount: 0,
  recordCount: 0,
  fileCount: 0,
  fileSizeBytes: 0,
  warnings: [],
};

export function usePortfolioBackup() {
  const [progress, setProgress] = useState<BackupProgress>(INITIAL_PROGRESS);
  const abortRef = useRef(false);

  const patch = useCallback(
    (partial: Partial<BackupProgress>) => setProgress(prev => ({ ...prev, ...partial })),
    [],
  );

  const startBackup = useCallback(
    async (options: { includeFiles: boolean; essentialOnly: boolean }) => {
      abortRef.current = false;

      const warnings: string[] = [];
      const zip = new JSZip();
      const dateStr = format(new Date(), 'yyyy-MM-dd-HHmm');
      const root = `hydrogencap-backup-${dateStr}`;

      const tables = options.essentialOnly
        ? BACKUP_TABLES.filter(t => t.essential)
        : BACKUP_TABLES;

      const fileDownloadWeight = options.includeFiles ? 4 : 0;
      const totalSteps = tables.length + fileDownloadWeight + 1;
      let stepsCompleted = 0;
      let totalRecords = 0;
      let totalFiles = 0;
      let totalFileSize = 0;

      const fileIndex: FileIndexEntry[] = [];
      const tableSummary: Array<{ table: string; count: number }> = [];

      // ── PHASE 1: Export database rows ──────────────────────────

      patch({
        ...INITIAL_PROGRESS,
        phase: 'exporting-data',
        currentStep: 'Starting data export…',
        total: tables.length,
      });

      for (const cfg of tables) {
        if (abortRef.current) break;

        patch({
          currentStep: `Exporting ${cfg.label}…`,
          completed: stepsCompleted,
          total: tables.length,
          overallPercent: Math.round((stepsCompleted / totalSteps) * 100),
        });

        try {
          const allRows = await fetchAllRows(cfg.table, warnings);

          // Filter out soft-deleted documents
          const rows =
            cfg.table === 'documents'
              ? allRows.filter((r: any) => !r.deleted_at)
              : allRows;

          zip.file(`${root}/data/${cfg.prefix}-${cfg.table}.json`, JSON.stringify(rows, null, 2));

          totalRecords += rows.length;
          tableSummary.push({ table: cfg.table, count: rows.length });

          // Collect file URLs to download in phase 2
          if (options.includeFiles && cfg.fileUrlColumn && cfg.storageBucket) {
            for (const row of rows) {
              const url = row[cfg.fileUrlColumn];
              if (url && typeof url === 'string') {
                const storagePath = extractStoragePath(url, cfg.storageBucket);
                if (storagePath) {
                  fileIndex.push({
                    originalUrl: url,
                    zipPath: `${root}/files/${cfg.storageBucket}/${storagePath}`,
                    table: cfg.table,
                    recordId: row.id,
                    bucket: cfg.storageBucket,
                    sizeBytes: 0,
                  });
                }
              }
            }
          }
        } catch (err: any) {
          warnings.push(`Failed to export ${cfg.table}: ${err.message}`);
        }

        stepsCompleted++;
        patch({
          completed: stepsCompleted,
          tableCount: tableSummary.length,
          recordCount: totalRecords,
          warnings: [...warnings],
        });
      }

      // ── PHASE 2: Download files ────────────────────────────────

      if (options.includeFiles && fileIndex.length > 0 && !abortRef.current) {
        const unique = new Map<string, FileIndexEntry>();
        for (const entry of fileIndex) {
          if (!unique.has(entry.zipPath)) unique.set(entry.zipPath, entry);
        }

        patch({
          phase: 'downloading-files',
          currentStep: `Downloading ${unique.size} files…`,
          completed: 0,
          total: unique.size,
          overallPercent: Math.round((stepsCompleted / totalSteps) * 100),
        });

        let filesDone = 0;

        for (const [, entry] of unique) {
          if (abortRef.current) break;

          const storagePath = extractStoragePath(entry.originalUrl, entry.bucket);
          if (!storagePath) {
            warnings.push(`Cannot parse path: ${entry.originalUrl}`);
            filesDone++;
            continue;
          }

          const shortName = storagePath.split('/').pop() || storagePath;
          patch({
            currentStep: `Downloading ${filesDone + 1}/${unique.size}: ${shortName}`,
            completed: filesDone,
            total: unique.size,
          });

          try {
            const { data, error } = await supabase.storage
              .from(entry.bucket)
              .download(storagePath);

            if (error) {
              warnings.push(`${entry.bucket}/${shortName}: ${error.message}`);
            } else if (data) {
              const buf = await data.arrayBuffer();
              zip.file(entry.zipPath, buf);
              entry.sizeBytes = buf.byteLength;
              totalFileSize += buf.byteLength;
              totalFiles++;
            }
          } catch (err: any) {
            warnings.push(`${entry.bucket}/${shortName}: ${err.message}`);
          }

          filesDone++;
          patch({
            completed: filesDone,
            fileCount: totalFiles,
            fileSizeBytes: totalFileSize,
            warnings: [...warnings],
          });
        }

        stepsCompleted += fileDownloadWeight;
      }

      if (abortRef.current) {
        patch({ phase: 'idle', currentStep: 'Backup cancelled.' });
        return;
      }

      // ── PHASE 3: Build ZIP ─────────────────────────────────────

      patch({ phase: 'building-zip', currentStep: 'Building archive…', overallPercent: 90 });

      zip.file(`${root}/file_index.json`, JSON.stringify(fileIndex, null, 2));

      const manifest = {
        version: '1.0.0',
        format: 'hydrogencap-backup',
        createdAt: new Date().toISOString(),
        app: 'HydrogenCap',
        tables: tableSummary,
        totalRecords,
        totalFiles,
        totalFileSizeBytes: totalFileSize,
        includesFiles: options.includeFiles,
        essentialOnly: options.essentialOnly,
        warnings,
      };
      zip.file(`${root}/manifest.json`, JSON.stringify(manifest, null, 2));

      zip.file(`${root}/SUMMARY.md`, generateSummaryMarkdown(manifest, tableSummary, warnings));

      try {
        patch({ currentStep: 'Compressing…' });

        const blob = await zip.generateAsync(
          { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
          (meta) => patch({ overallPercent: 90 + Math.round(meta.percent * 0.1) }),
        );

        // Use direct blob URL download instead of file-saver for better large-file support
        const fileName = `hydrogencap-backup-${dateStr}.zip`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        // Clean up after a delay to allow the download to start
        setTimeout(() => {
          URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }, 5000);

        patch({
          phase: 'complete',
          currentStep: `Backup complete — ${fileName}`,
          overallPercent: 100,
          tableCount: tableSummary.length,
          recordCount: totalRecords,
          fileCount: totalFiles,
          fileSizeBytes: totalFileSize,
          warnings: [...warnings],
        });
      } catch (err: any) {
        patch({
          phase: 'error',
          currentStep: `ZIP generation failed: ${err.message}`,
          warnings: [...warnings, err.message],
        });
      }
    },
    [patch],
  );

  const cancelBackup = useCallback(() => {
    abortRef.current = true;
  }, []);

  const resetBackup = useCallback(() => setProgress(INITIAL_PROGRESS), []);

  return { progress, startBackup, cancelBackup, resetBackup };
}

// ─── Data fetching (paginated) ───────────────────────────────────

const BATCH = 1000;

async function fetchAllRows(table: string, warnings: string[]): Promise<any[]> {
  let all: any[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let result = await (supabase as any)
      .from(table)
      .select('*')
      .range(offset, offset + BATCH - 1)
      .order('created_at', { ascending: true });

    // Fallback: some tables lack created_at
    if (result.error?.message?.includes('created_at')) {
      result = await (supabase as any)
        .from(table)
        .select('*')
        .range(offset, offset + BATCH - 1);
    }

    if (result.error) {
      warnings.push(`${table}: ${result.error.message}`);
      break;
    }

    const rows = result.data ?? [];
    all = all.concat(rows);
    hasMore = rows.length === BATCH;
    offset += BATCH;
  }

  return all;
}
