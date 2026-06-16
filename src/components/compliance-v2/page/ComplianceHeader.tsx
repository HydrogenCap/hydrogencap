import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Download, Printer, RefreshCw, ShieldCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  uniquePropertyCount: number;
  dataUpdatedAt: number;
  rescanning: boolean;
  onRescan: () => void;
  onExport: () => void;
  exportDisabled: boolean;
  filtersActive: boolean;
  filteredCount: number;
  totalCount: number;
}

export function ComplianceHeader(p: Props) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="h-6 w-6" />
          Compliance Dashboard
        </h1>
        <p className="text-muted-foreground">
          {p.uniquePropertyCount > 0
            ? `${p.uniquePropertyCount} ${p.uniquePropertyCount === 1 ? 'property' : 'properties'} · Portfolio-wide compliance monitoring`
            : 'Portfolio-wide compliance monitoring and document management'}
          {p.dataUpdatedAt > 0 && (
            <span className="ml-2 text-xs">· Updated {formatDistanceToNow(new Date(p.dataUpdatedAt), { addSuffix: true })}</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={p.onExport} disabled={p.exportDisabled}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV{p.filtersActive && p.totalCount ? ` (${p.filteredCount})` : ''}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          title="Print the compliance register"
          className="print:hidden"
        >
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={p.onRescan}
          disabled={p.rescanning}
          title="Re-run AI extraction on Vault documents that previously failed or are still pending"
          className="print:hidden"
        >
          <RefreshCw className={cn('h-4 w-4 mr-2', p.rescanning && 'animate-spin')} />
          {p.rescanning ? 'Rescanning…' : 'Rescan Vault Documents'}
        </Button>
      </div>
    </div>
  );
}
