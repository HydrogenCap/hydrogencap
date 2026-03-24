import { cn } from '@/lib/utils';
import type { ComplianceStatusV2, ComplianceDocType } from '@/lib/complianceV2Types';
import { DOC_TYPE_SHORT_LABELS, MATRIX_COLUMN_ORDER } from '@/lib/complianceV2Types';
import type { ComplianceMatrixRow } from '@/lib/complianceV2Types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DOC_TYPE_DISPLAY_NAMES } from '@/lib/complianceV2Types';

interface ComplianceMatrixGridProps {
  rows: ComplianceMatrixRow[];
  onCellClick: (propertyId: string, docType: ComplianceDocType) => void;
  statusFilter: string;
  searchQuery: string;
}

/** Group matrix rows by property */
function groupByProperty(rows: ComplianceMatrixRow[]) {
  const map = new Map<string, { address: string; propertyType: string; entityName: string | null; cells: Map<ComplianceDocType, ComplianceMatrixRow> }>();
  for (const row of rows) {
    if (!map.has(row.property_id)) {
      map.set(row.property_id, {
        address: row.property_address,
        propertyType: row.property_type,
        entityName: row.entity_name,
        cells: new Map(),
      });
    }
    map.get(row.property_id)!.cells.set(row.document_type, row);
  }
  return map;
}

function StatusDot({ status, daysRemaining }: { status: ComplianceStatusV2; daysRemaining: number | null }) {
  const dotBase = 'h-3 w-3 rounded-full inline-block';

  switch (status) {
    case 'valid':
      return <span className={cn(dotBase, 'bg-success')} />;
    case 'expiring_soon':
      return (
        <span className="flex items-center gap-1">
          <span className={cn(dotBase, 'bg-warning')} />
          <span className="text-[10px] text-warning font-medium">{daysRemaining}d</span>
        </span>
      );
    case 'critical':
      return (
        <span className="flex items-center gap-1">
          <span className={cn(dotBase, 'bg-destructive animate-pulse')} />
          <span className="text-[10px] text-destructive font-bold">{daysRemaining}d</span>
        </span>
      );
    case 'expired':
      return (
        <span className="flex items-center gap-1">
          <span className={cn(dotBase, 'bg-destructive')} />
          <span className="text-[10px] text-destructive font-bold">EXPIRED</span>
        </span>
      );
    case 'missing':
      return (
        <span className="flex items-center gap-1">
          <span className={cn(dotBase, 'border-2 border-destructive bg-transparent')} />
          <span className="text-[10px] text-destructive font-medium">MISSING</span>
        </span>
      );
    case 'not_required':
      return <span className={cn(dotBase, 'bg-muted')} />;
    default:
      return <span className="text-muted-foreground">—</span>;
  }
}

function shouldShowProperty(cells: Map<ComplianceDocType, ComplianceMatrixRow>, statusFilter: string): boolean {
  if (statusFilter === 'all') return true;
  const statuses = Array.from(cells.values()).map(c => c.calculated_status);
  switch (statusFilter) {
    case 'needs_attention':
      return statuses.some(s => ['expiring_soon', 'critical', 'expired', 'missing'].includes(s));
    case 'expired':
      return statuses.some(s => s === 'expired');
    case 'missing':
      return statuses.some(s => s === 'missing');
    case 'valid':
      return statuses.every(s => s === 'valid' || s === 'not_required');
    default:
      return true;
  }
}

export function ComplianceMatrixGrid({ rows, onCellClick, statusFilter, searchQuery }: ComplianceMatrixGridProps) {
  const grouped = groupByProperty(rows);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left p-2 font-medium text-muted-foreground sticky left-0 bg-muted/50 min-w-[200px] z-10">Property</th>
              {MATRIX_COLUMN_ORDER.map(docType => (
                <th key={docType} className="p-2 text-center font-medium text-muted-foreground whitespace-nowrap text-xs">
                  {DOC_TYPE_SHORT_LABELS[docType]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from(grouped.entries())
              .filter(([, prop]) => {
                if (searchQuery && !prop.address.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                return shouldShowProperty(prop.cells, statusFilter);
              })
              .sort(([, a], [, b]) => a.address.localeCompare(b.address))
              .map(([propertyId, prop]) => (
                <tr key={propertyId} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="p-2 font-medium sticky left-0 bg-background z-10">
                    <div className="truncate max-w-[220px]" title={prop.address}>{prop.address}</div>
                    {prop.entityName && <div className="text-[10px] text-muted-foreground truncate">{prop.entityName}</div>}
                  </td>
                  {MATRIX_COLUMN_ORDER.map(docType => {
                    const cell = prop.cells.get(docType);
                    return (
                      <td key={docType} className="p-1 text-center">
                        {cell ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                className="p-1 rounded hover:bg-muted/50 transition-colors inline-flex items-center justify-center"
                                onClick={() => onCellClick(propertyId, docType)}
                              >
                                <StatusDot status={cell.calculated_status} daysRemaining={cell.days_remaining} />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs max-w-[200px]">
                              <p className="font-medium">{DOC_TYPE_DISPLAY_NAMES[docType]}</p>
                              <p className="capitalize">{cell.calculated_status.replace('_', ' ')}</p>
                              {cell.days_remaining !== null && <p>{cell.days_remaining} days remaining</p>}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
          </tbody>
        </table>
        {grouped.size === 0 && (
          <div className="text-center py-12 text-muted-foreground">No compliance data available. Add properties to get started.</div>
        )}
      </div>
    </TooltipProvider>
  );
}
