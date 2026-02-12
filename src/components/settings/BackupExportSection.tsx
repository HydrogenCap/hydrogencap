import { useState } from 'react';
import {
  Download,
  HardDrive,
  FileArchive,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
  Image,
  Shield,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { usePortfolioBackup, type BackupPhase } from '@/hooks/usePortfolioBackup';
import { formatBytes } from '@/lib/backupConfig';

// ─── Constants ───────────────────────────────────────────────────

const PHASE_LABELS: Record<BackupPhase, string> = {
  idle: '',
  'exporting-data': 'Exporting database records',
  'downloading-files': 'Downloading uploaded files',
  'building-zip': 'Building ZIP archive',
  complete: 'Backup complete',
  error: 'Backup failed',
};

// ─── Component ───────────────────────────────────────────────────

export function BackupExportSection() {
  const { progress, startBackup, cancelBackup, resetBackup } = usePortfolioBackup();
  const [includeFiles, setIncludeFiles] = useState(true);
  const [essentialOnly, setEssentialOnly] = useState(false);

  const isRunning =
    progress.phase !== 'idle' &&
    progress.phase !== 'complete' &&
    progress.phase !== 'error';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Backup &amp; Export
        </CardTitle>
        <CardDescription>
          Download a complete backup of your portfolio data and uploaded files.
          The ZIP can be used to restore everything into a fresh instance.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ── Options (idle only) ─────────────────────────────── */}
        {progress.phase === 'idle' && (
          <>
            <div className="space-y-4">
              {/* Include files */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="include-files"
                    className="text-sm font-medium flex items-center gap-2"
                  >
                    <Image className="h-4 w-4" />
                    Include uploaded files
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Photos, compliance certificates, floorplans and documents.
                    Disabling this exports data only (much faster).
                  </p>
                </div>
                <Switch
                  id="include-files"
                  checked={includeFiles}
                  onCheckedChange={setIncludeFiles}
                />
              </div>

              {/* Essential only */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="essential-only"
                    className="text-sm font-medium flex items-center gap-2"
                  >
                    <Shield className="h-4 w-4" />
                    Essential data only
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Core tables only — properties, companies, tenants, loans,
                    compliance, rent. Skips ownership groups, comparable sales,
                    activity log, etc.
                  </p>
                </div>
                <Switch
                  id="essential-only"
                  checked={essentialOnly}
                  onCheckedChange={setEssentialOnly}
                />
              </div>
            </div>

            {/* Start with confirmation */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="w-full" size="lg">
                  <Download className="h-4 w-4 mr-2" />
                  Start Backup
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Start Portfolio Backup?</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-3">
                      <p>This will export:</p>
                      <ul className="list-disc pl-5 space-y-1 text-sm">
                        <li>
                          {essentialOnly
                            ? 'Essential database tables only'
                            : 'All database tables (50+ tables)'}
                        </li>
                        {includeFiles && (
                          <li>
                            All uploaded files (certificates, photos, documents,
                            floorplans)
                          </li>
                        )}
                        <li>A manifest and human-readable summary</li>
                      </ul>
                      {includeFiles && (
                        <p className="text-amber-600 text-sm">
                          Including files may take several minutes for large
                          portfolios. Keep this tab open during the backup.
                        </p>
                      )}
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      startBackup({ includeFiles, essentialOnly })
                    }
                  >
                    <FileArchive className="h-4 w-4 mr-2" />
                    Start Backup
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}

        {/* ── Progress (running) ──────────────────────────────── */}
        {isRunning && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-medium">
                  {PHASE_LABELS[progress.phase]}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={cancelBackup}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>

            <Progress value={progress.overallPercent} className="h-2" />

            <p className="text-xs text-muted-foreground truncate">
              {progress.currentStep}
            </p>

            <Stats
              tables={progress.tableCount}
              records={progress.recordCount}
              files={progress.fileCount}
              bytes={progress.fileSizeBytes}
            />
          </div>
        )}

        {/* ── Complete ────────────────────────────────────────── */}
        {progress.phase === 'complete' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">{progress.currentStep}</span>
            </div>

            <div className="rounded-lg border p-4">
              <Stats
                tables={progress.tableCount}
                records={progress.recordCount}
                files={progress.fileCount}
                bytes={progress.fileSizeBytes}
              />
            </div>

            <Warnings list={progress.warnings} />

            <Button variant="outline" className="w-full" onClick={resetBackup}>
              Done
            </Button>
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────── */}
        {progress.phase === 'error' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">{progress.currentStep}</span>
            </div>

            <Warnings list={progress.warnings} />

            <Button variant="outline" className="w-full" onClick={resetBackup}>
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

function Stats({
  tables,
  records,
  files,
  bytes,
}: {
  tables: number;
  records: number;
  files: number;
  bytes: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-4 text-center">
      <div>
        <p className="text-2xl font-bold tabular-nums">{tables}</p>
        <p className="text-xs text-muted-foreground">Tables</p>
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums">
          {records.toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground">Records</p>
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums">
          {files > 0 ? formatBytes(bytes) : '—'}
        </p>
        <p className="text-xs text-muted-foreground">
          {files > 0 ? `${files} files` : 'Files'}
        </p>
      </div>
    </div>
  );
}

function Warnings({ list }: { list: string[] }) {
  if (list.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-medium text-amber-600">
          {list.length} warning{list.length > 1 ? 's' : ''}
        </span>
      </div>
      <ScrollArea className="max-h-32">
        <ul className="text-xs text-muted-foreground space-y-1">
          {list.map((w, i) => (
            <li key={i}>• {w}</li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
}
