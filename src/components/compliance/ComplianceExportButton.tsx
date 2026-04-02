import { useState } from 'react';
import {
  Download,
  CheckCircle2,
  AlertTriangle,
  FileArchive,
  ChevronDown,
  Home,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useComplianceDocumentExport,
  type ExportPhase,
} from '@/hooks/useComplianceDocumentExport';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const PHASE_LABELS: Record<ExportPhase, string> = {
  idle: '',
  loading: 'Loading compliance data',
  downloading: 'Downloading documents',
  zipping: 'Building ZIP archive',
  complete: 'Export complete',
  error: 'Export failed',
};

export function ComplianceExportButton() {
  const { progress, startExport, cancelExport, resetExport } = useComplianceDocumentExport();
  const { data: properties } = useQuery({
    queryKey: ['properties-list-light'],
    queryFn: async () => {
      const allData: { id: string; address_line_1: string }[] = [];
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await (supabase as any)
          .from('properties_v2')
          .select('id, address_line_1')
          .order('address_line_1')
          .range(offset, offset + batchSize - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          allData.push(...data);
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }
      return allData;
    },
  });
  const [dialogOpen, setDialogOpen] = useState(false);

  const isRunning = progress.phase !== 'idle' && progress.phase !== 'complete' && progress.phase !== 'error';

  const handleExport = (propertyId?: string) => {
    setDialogOpen(true);
    startExport(propertyId ? { propertyId } : undefined);
  };

  const handleClose = () => {
    if (isRunning) {
      cancelExport();
    } else {
      resetExport();
    }
    setDialogOpen(false);
  };

  const sortedProperties = properties || [];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Download Documents
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 max-h-80 overflow-y-auto">
          <DropdownMenuItem onClick={() => handleExport()}>
            <FileArchive className="h-4 w-4 mr-2" />
            All Properties
          </DropdownMenuItem>
          {sortedProperties.length > 0 && (
            <>
              <DropdownMenuSeparator />
              {sortedProperties.map((p) => (
                <DropdownMenuItem key={p.id} onClick={() => handleExport(p.id)}>
                  <Home className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="truncate">{p.address_line_1}</span>
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileArchive className="h-5 w-5" />
              Compliance Documents Export
            </DialogTitle>
            <DialogDescription>
              {progress.phase === 'idle'
                ? 'Preparing to download compliance documents as a ZIP file.'
                : PHASE_LABELS[progress.phase]}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Running state */}
            {isRunning && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground truncate flex-1 mr-4">
                      {progress.currentStep}
                    </span>
                    <span className="text-muted-foreground font-mono text-xs">
                      {progress.percent}%
                    </span>
                  </div>
                  <Progress value={progress.percent} className="h-2" />
                </div>

                {progress.phase === 'downloading' && progress.total > 0 && (
                  <div className="flex gap-3 text-sm">
                    <span className="text-muted-foreground">
                      {progress.completed} / {progress.total} files
                    </span>
                    {progress.skipped > 0 && (
                      <span className="text-amber-500">
                        {progress.skipped} skipped
                      </span>
                    )}
                  </div>
                )}

                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={cancelExport}>
                    Cancel
                  </Button>
                </div>
              </>
            )}

            {/* Complete state */}
            {progress.phase === 'complete' && (
              <>
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  </div>
                  <p className="text-sm font-medium text-center">
                    {progress.currentStep}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-lg font-bold">{progress.downloaded}</div>
                    <div className="text-[10px] text-muted-foreground">Downloaded</div>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-lg font-bold text-amber-500">{progress.skipped}</div>
                    <div className="text-[10px] text-muted-foreground">Skipped</div>
                  </div>
                </div>

                {progress.errors.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                      {progress.errors.length} file{progress.errors.length !== 1 ? 's' : ''} could not be downloaded
                    </p>
                    <ScrollArea className="max-h-32 rounded border p-2">
                      {progress.errors.map((err, i) => (
                        <p key={i} className="text-xs text-muted-foreground py-0.5">{err}</p>
                      ))}
                    </ScrollArea>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button size="sm" onClick={handleClose}>
                    Done
                  </Button>
                </div>
              </>
            )}

            {/* Error state */}
            {progress.phase === 'error' && (
              <>
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-destructive" />
                  </div>
                  <p className="text-sm font-medium text-center text-destructive">
                    {progress.currentStep}
                  </p>
                </div>

                {progress.errors.length > 0 && (
                  <ScrollArea className="max-h-32 rounded border p-2">
                    {progress.errors.map((err, i) => (
                      <p key={i} className="text-xs text-muted-foreground py-0.5">{err}</p>
                    ))}
                  </ScrollArea>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={handleClose}>
                    Close
                  </Button>
                  <Button size="sm" onClick={() => startExport()}>
                    Try Again
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
