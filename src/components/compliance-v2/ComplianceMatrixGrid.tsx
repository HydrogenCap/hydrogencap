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

const STATUS_WEIGHT: Record<string, number> = {
  expired: 1000,
  missing: 900,
  critical: 800,
  expiring_soon: 400,
  valid: 0,
  not_required: 0,
};

function rowUrgency(cells: Map<ComplianceDocType, ComplianceMatrixRow>) {
  let score = 0;
  let issues = 0;
  for (const cell of cells.values()) {
    const w = STATUS_WEIGHT[cell.calculated_status] ?? 0;
    score += w;
    if (w >= 400) issues += 1;
  }
  return { score, issues };
}

export function ComplianceMatrixGrid({ rows, onCellClick, statusFilter, searchQuery }: ComplianceMatrixGridProps) {
  const grouped = groupByProperty(rows);
  const visibleEntries = Array.from(grouped.entries())
    .filter(([, prop]) => {
      if (searchQuery && !prop.address.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return shouldShowProperty(prop.cells, statusFilter);
    })
    .map(([id, prop]) => ({ id, prop, urgency: rowUrgency(prop.cells) }))
    .sort((a, b) => {
      // Most urgent first; ties → alphabetical
      if (b.urgency.score !== a.urgency.score) return b.urgency.score - a.urgency.score;
      return a.prop.address.localeCompare(b.prop.address);
    });

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-2">
        {/* Summary tallies + Legend */}
        {(() => {
          const visibleCells = visibleEntries.flatMap(e => Array.from(e.prop.cells.values()));
          const tally = {
            valid: visibleCells.filter(c => c.calculated_status === 'valid').length,
            expiring: visibleCells.filter(c => c.calculated_status === 'expiring_soon').length,
            critical: visibleCells.filter(c => c.calculated_status === 'critical').length,
            expired: visibleCells.filter(c => c.calculated_status === 'expired').length,
            missing: visibleCells.filter(c => c.calculated_status === 'missing').length,
          };
          return (
            <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground px-1">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-success inline-block" /> Valid <span className="text-foreground font-medium">{tally.valid}</span></span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-warning inline-block" /> Expiring <span className="text-foreground font-medium">{tally.expiring}</span></span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-destructive inline-block animate-pulse" /> Critical <span className="text-foreground font-medium">{tally.critical}</span></span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-destructive inline-block" /> Expired <span className="text-foreground font-medium">{tally.expired}</span></span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-destructive inline-block" /> Missing <span className="text-foreground font-medium">{tally.missing}</span></span>
              <span className="ml-auto">Sorted by urgency · {visibleEntries.length} of {grouped.size} properties</span>
            </div>
          );
        })()}

        <div className="overflow-x-auto overflow-y-auto max-h-[70vh] border rounded-lg">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-20">
              <tr className="bg-muted">
                <th className="text-left p-2 font-medium text-muted-foreground sticky left-0 bg-muted min-w-[200px] z-30 shadow-[1px_0_0_0_hsl(var(--border))]">Property</th>
                {MATRIX_COLUMN_ORDER.map(docType => (
                  <Tooltip key={docType}>
                    <TooltipTrigger asChild>
                      <th className="p-2 text-center font-medium text-muted-foreground whitespace-nowrap text-xs cursor-help hover:bg-muted/80 transition-colors">
                        {DOC_TYPE_SHORT_LABELS[docType]}
                      </th>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      {DOC_TYPE_DISPLAY_NAMES[docType]}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleEntries.map(({ id: propertyId, prop, urgency }) => {
                const hasExpiredOrMissing = Array.from(prop.cells.values()).some(c => c.calculated_status === 'expired' || c.calculated_status === 'missing');
                return (
                  <tr
                    key={propertyId}
                    className={cn(
                      'border-t transition-colors',
                      hasExpiredOrMissing ? 'bg-destructive/[0.03] hover:bg-destructive/[0.06]' : 'hover:bg-muted/30',
                    )}
                  >
                    <td className={cn('p-2 font-medium sticky left-0 z-10', hasExpiredOrMissing ? 'bg-destructive/[0.03]' : 'bg-background')}>
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate max-w-[180px]" title={prop.address}>{prop.address}</div>
                          {prop.entityName && <div className="text-[10px] text-muted-foreground truncate">{prop.entityName}</div>}
                        </div>
                        {urgency.issues > 0 && (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive shrink-0"
                            title={`${urgency.issues} item${urgency.issues === 1 ? '' : 's'} need attention`}
                          >
                            {urgency.issues}
                          </span>
                        )}
                      </div>
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
                );
              })}
            </tbody>
          </table>
          {grouped.size === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No compliance data available. Add properties to get started.</div>
          ) : visibleEntries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No properties match the current filters.</div>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
}
