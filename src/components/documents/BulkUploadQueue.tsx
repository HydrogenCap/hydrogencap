import { FileText, RotateCcw, X, Loader2, Image } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SEVERITY } from '@/lib/design-tokens';
import type { QueueItem, QueueItemStatus } from '@/hooks/useBulkDocumentUpload';

interface PropertyOption {
  id: string;
  address_line_1: string;
  postcode: string;
}

interface BulkUploadQueueProps {
  items: QueueItem[];
  properties: PropertyOption[];
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  onSetProperty: (id: string, propertyId: string) => void;
}

const STATUS_CONFIG: Record<QueueItemStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; spinning?: boolean }> = {
  queued: { label: 'Queued', variant: 'outline' },
  uploading: { label: 'Uploading', variant: 'outline', spinning: true },
  classifying: { label: 'Classifying', variant: 'outline', spinning: true },
  extracting: { label: 'Extracting', variant: 'outline', spinning: true },
  done: { label: 'Done', variant: 'default' },
  error: { label: 'Error', variant: 'destructive' },
};

function StatusBadge({ status }: { status: QueueItemStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant} className="gap-1">
      {config.spinning && <Loader2 className="h-3 w-3 animate-spin" />}
      {config.label}
    </Badge>
  );
}

function ClassificationBadge({ docType, confidence }: { docType: string | null; confidence: number }) {
  if (!docType) return <span className="text-xs text-muted-foreground">--</span>;

  const label = docType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const pct = Math.round(confidence * 100);
  const severityKey = pct >= 80 ? 'success' : pct >= 50 ? 'warning' : 'critical';

  return (
    <Badge className={`${SEVERITY[severityKey].badge} text-xs font-normal`}>
      {label}
    </Badge>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const colorClass = pct >= 80
    ? 'bg-green-500'
    : pct >= 50
      ? 'bg-amber-500'
      : 'bg-red-500';

  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{pct}%</span>
    </div>
  );
}

function FileThumbnail({ item }: { item: QueueItem }) {
  if (item.thumbnailUrl) {
    return (
      <div className="h-8 w-8 rounded border overflow-hidden flex-shrink-0">
        <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }

  const isPdf = item.file.type === 'application/pdf';
  return (
    <div className="h-8 w-8 rounded border bg-muted flex items-center justify-center flex-shrink-0">
      {isPdf ? <FileText className="h-4 w-4 text-muted-foreground" /> : <Image className="h-4 w-4 text-muted-foreground" />}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function QueueRow({
  item,
  properties,
  onRetry,
  onRemove,
  onSetProperty,
}: {
  item: QueueItem;
  properties: PropertyOption[];
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  onSetProperty: (id: string, propertyId: string) => void;
}) {
  const selectedProp = item.selectedPropertyId || item.matchedPropertyId || '';
  const isActive = item.status === 'uploading' || item.status === 'classifying' || item.status === 'extracting';

  return (
    <div className={`flex items-center gap-3 px-4 py-3 border-b last:border-b-0 transition-colors ${
      item.status === 'error' ? 'bg-destructive/5' : item.status === 'done' ? 'bg-accent/30' : ''
    }`}>
      {/* Thumbnail */}
      <FileThumbnail item={item} />

      {/* Filename + Size */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate" title={item.file.name}>
          {item.file.name}
        </p>
        <p className="text-xs text-muted-foreground">{formatFileSize(item.file.size)}</p>
        {item.error && (
          <p className="text-xs text-destructive mt-0.5">{item.error}</p>
        )}
      </div>

      {/* Status */}
      <div className="flex-shrink-0">
        <StatusBadge status={item.status} />
      </div>

      {/* AI Classification */}
      <div className="flex-shrink-0 w-[140px]">
        <ClassificationBadge
          docType={item.classification.documentType}
          confidence={item.classification.confidence}
        />
      </div>

      {/* Property Assignment */}
      <div className="flex-shrink-0 w-[200px]">
        {item.status === 'done' || item.status === 'error' ? (
          <Select value={selectedProp} onValueChange={v => onSetProperty(item.id, v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Assign property..." />
            </SelectTrigger>
            <SelectContent>
              {properties.map(p => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.address_line_1}{p.postcode ? `, ${p.postcode}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-muted-foreground">--</span>
        )}
      </div>

      {/* Confidence Bar */}
      <div className="flex-shrink-0 w-[120px]">
        {item.classification.confidence > 0 ? (
          <ConfidenceBar confidence={item.classification.confidence} />
        ) : (
          <span className="text-xs text-muted-foreground">--</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {item.status === 'error' && (
          <Button aria-label="Undo"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => onRetry(item.id)}
            title="Retry"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
        {!isActive && (
          <Button aria-label="Close"
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(item.id)}
            title="Remove"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function BulkUploadQueue({ items, properties, onRetry, onRemove, onSetProperty }: BulkUploadQueueProps) {
  if (items.length === 0) return null;

  const processingCount = items.filter(i =>
    i.status === 'uploading' || i.status === 'classifying' || i.status === 'extracting'
  ).length;
  const doneCount = items.filter(i => i.status === 'done').length;
  const errorCount = items.filter(i => i.status === 'error').length;

  return (
    <div className="space-y-3">
      {/* Queue header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium">Upload Queue</h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{items.length} files</span>
            {doneCount > 0 && <span className={SEVERITY.success.text}>{doneCount} done</span>}
            {processingCount > 0 && <span className={SEVERITY.info.text}>{processingCount} processing</span>}
            {errorCount > 0 && <span className={SEVERITY.critical.text}>{errorCount} failed</span>}
          </div>
        </div>
      </div>

      {/* Processing progress */}
      {processingCount > 0 && (
        <Progress
          value={Math.round(((doneCount + errorCount) / items.length) * 100)}
          className="h-1.5"
        />
      )}

      {/* Queue list */}
      <div className="border rounded-lg overflow-hidden">
        {/* Column headers */}
        <div className="flex items-center gap-3 px-4 py-2 bg-muted/50 border-b text-xs text-muted-foreground font-medium">
          <div className="w-8" />
          <div className="flex-1">File</div>
          <div className="flex-shrink-0 w-[80px]">Status</div>
          <div className="flex-shrink-0 w-[140px]">Classification</div>
          <div className="flex-shrink-0 w-[200px]">Property</div>
          <div className="flex-shrink-0 w-[120px]">Confidence</div>
          <div className="flex-shrink-0 w-[60px]">Actions</div>
        </div>

        {/* Rows */}
        <div className="max-h-[500px] overflow-y-auto">
          {items.map(item => (
            <QueueRow
              key={item.id}
              item={item}
              properties={properties}
              onRetry={onRetry}
              onRemove={onRemove}
              onSetProperty={onSetProperty}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
