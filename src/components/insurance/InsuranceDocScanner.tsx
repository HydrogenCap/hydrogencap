import { useRef } from 'react';
import { Upload, Loader2, CheckCircle2, XCircle, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  useInsuranceDocScan,
  type ExtractedInsuranceFields,
  type PropertyRef,
} from '@/hooks/useInsuranceDocScan';

const ACCEPTED = '.pdf,.png,.jpg,.jpeg,.webp';

interface InsuranceDocScannerProps {
  properties: PropertyRef[];
  onExtracted: (fields: ExtractedInsuranceFields) => void;
}

export function InsuranceDocScanner({ properties, onExtracted }: InsuranceDocScannerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { scans, scan, clear } = useInsuranceDocScan();

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    scan(Array.from(files), properties);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const anyScanning = scans.some(s => s.status === 'uploading' || s.status === 'scanning');
  const doneScans = scans.filter(s => s.status === 'done' && s.extracted);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" />
          Scan policy documents (optional)
        </div>
        {scans.length > 0 && (
          <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground" onClick={clear}>
            <X className="h-3 w-3 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Drop zone */}
      <div
        className={cn(
          'border-2 border-dashed rounded-lg px-4 py-5 text-center cursor-pointer transition-colors',
          'hover:border-primary/50 hover:bg-primary/5',
          anyScanning && 'pointer-events-none opacity-60',
        )}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
      >
        <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Drop insurance schedule PDFs or images here, or <span className="text-primary underline">browse</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          AI will extract insurer, policy number and dates automatically — multiple files supported
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {/* Per-file status list */}
      {scans.length > 0 && (
        <div className="space-y-2">
          {scans.map(s => (
            <div
              key={s.id}
              className={cn(
                'flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm',
                s.status === 'done' && 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-800',
                s.status === 'failed' && 'border-destructive/20 bg-destructive/5',
              )}
            >
              {/* Icon + name */}
              <div className="flex items-center gap-2 min-w-0">
                {(s.status === 'uploading' || s.status === 'scanning') && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                )}
                {s.status === 'done' && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                )}
                {s.status === 'failed' && (
                  <XCircle className="h-4 w-4 text-destructive shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-xs">{s.fileName}</p>
                  {s.status === 'uploading' && (
                    <p className="text-xs text-muted-foreground">Uploading…</p>
                  )}
                  {s.status === 'scanning' && (
                    <p className="text-xs text-muted-foreground">Scanning with AI…</p>
                  )}
                  {s.status === 'failed' && (
                    <p className="text-xs text-destructive">{s.error || 'Failed'}</p>
                  )}
                  {s.status === 'done' && s.extracted && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {s.extracted.insurer_name && (
                        <Badge variant="secondary" className="text-xs">{s.extracted.insurer_name}</Badge>
                      )}
                      {s.extracted.policy_number && (
                        <Badge variant="outline" className="text-xs">{s.extracted.policy_number}</Badge>
                      )}
                      {s.extracted.end_date && (
                        <Badge variant="outline" className="text-xs">Expires {s.extracted.end_date}</Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Use button */}
              {s.status === 'done' && s.extracted && (
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 h-7 text-xs"
                  onClick={() => onExtracted(s.extracted!)}
                >
                  Use data
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Hint when multiple scans done */}
      {doneScans.length > 1 && (
        <p className="text-xs text-muted-foreground text-center">
          {doneScans.length} scans complete — click "Use data" next to the policy you want to apply.
        </p>
      )}
    </div>
  );
}
