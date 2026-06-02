import { cn } from '@/lib/utils';
import type { ComplianceStatusV2, ComplianceDocType } from '@/lib/complianceV2Types';
import { DOC_TYPE_SHORT_LABELS, MATRIX_COLUMN_ORDER } from '@/lib/complianceV2Types';
import type { ComplianceMatrixRow } from '@/lib/complianceV2Types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DOC_TYPE_DISPLAY_NAMES } from '@/lib/complianceV2Types';
import { formatDistanceToNowStrict } from 'date-fns';
import type { MissingDiagnostics } from '@/hooks/useMissingComplianceDiagnostics';
import { diagnosticTotal } from '@/hooks/useMissingComplianceDiagnostics';

interface ComplianceMatrixGridProps {
  rows: ComplianceMatrixRow[];
  onCellClick: (propertyId: string, docType: ComplianceDocType) => void;
  statusFilter: string;
  searchQuery: string;
  /** Optional UI density */
  density?: 'comfortable' | 'compact';
  /** Optional property type filter (e.g. "HMO"); when omitted, all types shown */
  propertyTypeFilter?: string;
  /** Click handler from the legend chips to filter by status */
  onLegendStatusClick?: (status: string) => void;
  /** Optional callback when user wants to clear all filters from empty state */
  onClearFilters?: () => void;
  /** Per-cell "why missing?" diagnostics — unfiled / pending docs in the Inbox */
  diagnostics?: MissingDiagnostics;
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

function StatusDot({ status, daysRemaining, compact }: { status: ComplianceStatusV2; daysRemaining: number | null; compact?: boolean }) {
  const dotBase = compact ? 'h-2.5 w-2.5 rounded-full inline-block' : 'h-3 w-3 rounded-full inline-block';
  const labelSize = compact ? 'text-[9px]' : 'text-[10px]';

  switch (status) {
    case 'valid':
      return <span className={cn(dotBase, 'bg-success')} />;
    case 'expiring_soon':
      return (
        <span className="flex items-center gap-1">
          <span className={cn(dotBase, 'bg-warning')} />
          <span className={cn(labelSize, 'text-warning font-medium')}>{daysRemaining}d</span>
        </span>
      );
    case 'critical':
      return (
        <span className="flex items-center gap-1">
          <span className={cn(dotBase, 'bg-destructive animate-pulse')} />
          <span className={cn(labelSize, 'text-destructive font-bold')}>{daysRemaining}d</span>
        </span>
      );
    case 'expired':
      return (
        <span className="flex items-center gap-1">
          <span className={cn(dotBase, 'bg-destructive')} />
          <span className={cn(labelSize, 'text-destructive font-bold')}>EXPIRED</span>
        </span>
      );
    case 'missing':
      return (
        <span className="flex items-center gap-1">
          <span className={cn(dotBase, 'border-2 border-destructive bg-transparent')} />
          <span className={cn(labelSize, 'text-destructive font-medium')}>MISSING</span>
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

/** Highlight matched search substring within text */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-warning/30 text-foreground rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function ComplianceMatrixGrid({
  rows,
  onCellClick,
  statusFilter,
  searchQuery,
  density = 'comfortable',
  propertyTypeFilter,
  onLegendStatusClick,
  onClearFilters,
}: ComplianceMatrixGridProps) {
  const compact = density === 'compact';
  const cellPad = compact ? 'p-1' : 'p-2';
  const rowFontSize = compact ? 'text-xs' : 'text-sm';

  const grouped = groupByProperty(rows);
  const visibleEntries = Array.from(grouped.entries())
    .filter(([, prop]) => {
      if (searchQuery && !prop.address.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (propertyTypeFilter && propertyTypeFilter !== 'all' && (prop.propertyType || '').toLowerCase() !== propertyTypeFilter.toLowerCase()) return false;
      return shouldShowProperty(prop.cells, statusFilter);
    })
    .map(([id, prop]) => ({ id, prop, urgency: rowUrgency(prop.cells) }))
    .sort((a, b) => {
      if (b.urgency.score !== a.urgency.score) return b.urgency.score - a.urgency.score;
      return a.prop.address.localeCompare(b.prop.address);
    });

  // Per-column tallies (issues only) across visible rows
  const visibleCells = visibleEntries.flatMap(e => Array.from(e.prop.cells.values()));
  const columnIssues = new Map<ComplianceDocType, number>();
  for (const docType of MATRIX_COLUMN_ORDER) columnIssues.set(docType, 0);
  for (const c of visibleCells) {
    if (['expired', 'missing', 'critical', 'expiring_soon'].includes(c.calculated_status)) {
      columnIssues.set(c.document_type, (columnIssues.get(c.document_type) || 0) + 1);
    }
  }

  const tally = {
    valid: visibleCells.filter(c => c.calculated_status === 'valid').length,
    expiring: visibleCells.filter(c => c.calculated_status === 'expiring_soon').length,
    critical: visibleCells.filter(c => c.calculated_status === 'critical').length,
    expired: visibleCells.filter(c => c.calculated_status === 'expired').length,
    missing: visibleCells.filter(c => c.calculated_status === 'missing').length,
  };

  const legendChip = (label: string, count: number, dotCls: string, filterValue: string) => {
    const clickable = !!onLegendStatusClick;
    const active = statusFilter === filterValue;
    const Cmp: any = clickable ? 'button' : 'span';
    return (
      <Cmp
        type={clickable ? 'button' : undefined}
        onClick={clickable ? () => onLegendStatusClick!(filterValue) : undefined}
        className={cn(
          'flex items-center gap-1.5',
          clickable && 'hover:text-foreground hover:underline underline-offset-2 rounded transition-colors',
          active && 'text-foreground font-semibold',
        )}
        aria-pressed={clickable ? active : undefined}
      >
        <span className={cn('h-2.5 w-2.5 rounded-full inline-block', dotCls)} />
        {label} <span className="text-foreground font-medium">{count}</span>
      </Cmp>
    );
  };

  // Top doc types with most issues (for "Top issues" chips)
  const topIssues = Array.from(columnIssues.entries())
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-2">
        {/* Top issues chips */}
        {topIssues.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap text-xs px-1">
            <span className="text-muted-foreground">Top issues:</span>
            {topIssues.map(([docType, n]) => (
              <span
                key={docType}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium"
                title={`${n} item${n === 1 ? '' : 's'} with ${DOC_TYPE_DISPLAY_NAMES[docType]} issues`}
              >
                {DOC_TYPE_SHORT_LABELS[docType]} · {n}
              </span>
            ))}
          </div>
        )}

        {/* Summary tallies + Legend */}
        <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground px-1">
          {legendChip('Valid', tally.valid, 'bg-success', 'valid')}
          {legendChip('Expiring', tally.expiring, 'bg-warning', 'needs_attention')}
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-destructive inline-block animate-pulse" /> Critical <span className="text-foreground font-medium">{tally.critical}</span></span>
          {legendChip('Expired', tally.expired, 'bg-destructive', 'expired')}
          {legendChip('Missing', tally.missing, 'border-2 border-destructive', 'missing')}
          <span className="ml-auto">Sorted by urgency · {visibleEntries.length} of {grouped.size} properties</span>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[70vh] border rounded-lg">
          <table className={cn('w-full', rowFontSize)}>
            <thead className="sticky top-0 z-20">
              <tr className="bg-muted">
                <th className={cn('text-left font-medium text-muted-foreground sticky left-0 bg-muted min-w-[200px] z-30 shadow-[1px_0_0_0_hsl(var(--border))]', cellPad)}>Property</th>
                {MATRIX_COLUMN_ORDER.map(docType => (
                  <Tooltip key={docType}>
                    <TooltipTrigger asChild>
                      <th className={cn('text-center font-medium text-muted-foreground whitespace-nowrap text-xs cursor-help hover:bg-muted/80 transition-colors', cellPad)}>
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
                    <td className={cn('font-medium sticky left-0 z-10', cellPad, hasExpiredOrMissing ? 'bg-destructive/[0.03]' : 'bg-background')}>
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate max-w-[180px] flex items-center gap-1.5" title={prop.address}>
                            <span className="truncate"><Highlight text={prop.address} query={searchQuery} /></span>
                            {prop.propertyType && (
                              <span className="text-[9px] uppercase tracking-wide px-1 py-px rounded bg-muted text-muted-foreground shrink-0">
                                {prop.propertyType}
                              </span>
                            )}
                          </div>
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
                        <td key={docType} className={cn('text-center', compact ? 'p-0.5' : 'p-1')}>
                          {cell ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="p-1 rounded hover:bg-muted/50 transition-colors inline-flex items-center justify-center"
                                  onClick={() => onCellClick(propertyId, docType)}
                                >
                                  <StatusDot status={cell.calculated_status} daysRemaining={cell.days_remaining} compact={compact} />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs max-w-[220px]">
                                <p className="font-medium">{DOC_TYPE_DISPLAY_NAMES[docType]}</p>
                                <p className="capitalize">{cell.calculated_status.replace('_', ' ')}</p>
                                {cell.days_remaining !== null && <p>{cell.days_remaining} days remaining</p>}
                                {cell.calculated_status === 'valid' && cell.issue_date && (
                                  <p className="text-muted-foreground">Issued {formatDistanceToNowStrict(new Date(cell.issue_date), { addSuffix: true })}</p>
                                )}
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
            {visibleEntries.length > 0 && (
              <tfoot className="sticky bottom-0 z-10">
                <tr className="bg-muted/80 backdrop-blur border-t">
                  <td className={cn('font-medium text-xs text-muted-foreground sticky left-0 bg-muted/80 z-10', cellPad)}>
                    Issues by column
                  </td>
                  {MATRIX_COLUMN_ORDER.map(docType => {
                    const n = columnIssues.get(docType) || 0;
                    return (
                      <td key={docType} className={cn('text-center', cellPad)}>
                        <span
                          className={cn(
                            'inline-block text-[11px] font-semibold px-1.5 py-0.5 rounded-full',
                            n > 0 ? 'bg-destructive/10 text-destructive' : 'text-muted-foreground/60',
                          )}
                          title={`${n} issue${n === 1 ? '' : 's'} for ${DOC_TYPE_DISPLAY_NAMES[docType]}`}
                        >
                          {n}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
          {grouped.size === 0 ? (
            <div className="text-center py-12 px-6 text-muted-foreground">
              <p className="font-medium">No compliance data available</p>
              <p className="text-xs mt-1">Add properties from the Properties page, then upload compliance certificates to start tracking expiries.</p>
            </div>
          ) : visibleEntries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground space-y-2">
              <p>No properties match the current filters.</p>
              {onClearFilters && (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="text-xs text-primary hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
}
