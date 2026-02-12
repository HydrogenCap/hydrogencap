import { useState } from 'react';
import {
  FileEdit,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
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
import { useBatchRenameDocuments } from '@/hooks/useBatchRenameDocuments';

export function DocumentRenamingSection() {
  const { progress, startRename, cancelRename, resetRename } = useBatchRenameDocuments();
  const [overwriteExisting, setOverwriteExisting] = useState(false);

  const isRunning = progress.phase === 'scanning' || progress.phase === 'renaming';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileEdit className="h-5 w-5" />
          Document Auto-Naming
        </CardTitle>
        <CardDescription>
          Apply structured filenames to all documents. New uploads are named automatically.
          Use this to rename existing documents that were uploaded before auto-naming was enabled.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Naming convention preview */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
          <p className="text-sm font-medium">Naming convention</p>
          <code className="text-xs text-muted-foreground block">
            {'{'}<span className="text-primary">Category</span>{'}'}_{'{'}<span className="text-primary">Property/Company/Tenant</span>{'}'}_{'{'}<span className="text-primary">DocumentName</span>{'}'}_{'{'}<span className="text-primary">Date</span>{'}'}.ext
          </code>
          <p className="text-xs text-muted-foreground mt-1">
            Example: <span className="font-mono">GAS_12HighSt_GasSafetyCert_2024-03-15.pdf</span>
          </p>
        </div>

        {progress.phase === 'idle' && (
          <>
            {/* Overwrite toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="overwrite-names" className="text-sm font-medium flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Re-rename all documents
                </Label>
                <p className="text-xs text-muted-foreground">
                  When off, only documents without a structured name are renamed.
                  When on, all documents are re-processed (overwrites existing names).
                </p>
              </div>
              <Switch
                id="overwrite-names"
                checked={overwriteExisting}
                onCheckedChange={setOverwriteExisting}
              />
            </div>

            {/* Start button */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="w-full" size="lg">
                  <FileEdit className="h-4 w-4 mr-2" />
                  Rename Documents
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Rename Documents?</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-2">
                      <p>
                        {overwriteExisting
                          ? 'This will regenerate structured filenames for ALL documents, overwriting any existing names.'
                          : 'This will generate structured filenames for documents that don\'t have one yet. Existing names are preserved.'}
                      </p>
                      <p className="text-sm">
                        Only the download filename is changed — the actual stored file is not moved or copied.
                      </p>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => startRename({ overwriteExisting })}>
                    Rename
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}

        {/* Progress */}
        {isRunning && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-medium">
                  {progress.phase === 'scanning' ? 'Scanning documents…' : 'Renaming…'}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={cancelRename}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>

            {progress.total > 0 && (
              <Progress value={(progress.completed / progress.total) * 100} className="h-2" />
            )}

            <p className="text-xs text-muted-foreground">{progress.currentStep}</p>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold tabular-nums">{progress.total}</p>
                <p className="text-xs text-muted-foreground">Documents</p>
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums text-green-600">{progress.renamed}</p>
                <p className="text-xs text-muted-foreground">Renamed</p>
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums text-muted-foreground">{progress.skipped}</p>
                <p className="text-xs text-muted-foreground">Skipped</p>
              </div>
            </div>
          </div>
        )}

        {/* Complete */}
        {progress.phase === 'complete' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">{progress.currentStep}</span>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center rounded-lg border p-4">
              <div>
                <p className="text-2xl font-bold">{progress.total}</p>
                <p className="text-xs text-muted-foreground">Scanned</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{progress.renamed}</p>
                <p className="text-xs text-muted-foreground">Renamed</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-muted-foreground">{progress.skipped}</p>
                <p className="text-xs text-muted-foreground">Unchanged</p>
              </div>
            </div>

            {progress.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-600">
                    {progress.warnings.length} warning{progress.warnings.length > 1 ? 's' : ''}
                  </span>
                </div>
                <ScrollArea className="max-h-32">
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {progress.warnings.map((w, i) => (
                      <li key={i}>• {w}</li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}

            <Button variant="outline" className="w-full" onClick={resetRename}>
              Done
            </Button>
          </div>
        )}

        {/* Error */}
        {progress.phase === 'error' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">{progress.currentStep}</span>
            </div>
            <Button variant="outline" className="w-full" onClick={resetRename}>
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
