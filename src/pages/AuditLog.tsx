import { useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { Download, Search, ChevronDown, ChevronRight, Plus, Pencil, Trash2, History } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { useAuditLog } from '@/hooks/useAuditLog';
import {
  type AuditLogEntry, type AuditLogFilters,
  TABLE_DISPLAY_NAMES, getTableDisplayName, getRecordIdentifier,
  humanizeFieldName, formatAuditValue,
} from '@/lib/auditLogTypes';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 50;

const ACTION_STYLES: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive'; icon: React.ComponentType<{ className?: string }> }> = {
  INSERT: { label: 'Created', variant: 'default', icon: Plus },
  UPDATE: { label: 'Updated', variant: 'secondary', icon: Pencil },
  DELETE: { label: 'Deleted', variant: 'destructive', icon: Trash2 },
};

function AuditLogPage() {
  const [filters, setFilters] = useState<AuditLogFilters>({
    page: 1,
    pageSize: PAGE_SIZE,
    dateFrom: undefined,
    dateTo: undefined,
    tableName: 'all',
    action: 'all',
    search: '',
  });
  const [searchInput, setSearchInput] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data, isLoading } = useAuditLog(filters);
  const entries = useMemo(() => data?.entries || [], [data?.entries]);
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleSearch = useCallback(() => {
    setFilters(f => ({ ...f, search: searchInput, page: 1 }));
  }, [searchInput]);

  const exportCSV = useCallback(() => {
    if (!entries.length) return;
    const headers = ['Timestamp', 'Table', 'Action', 'Record ID', 'Changed Fields', 'Changed By', 'Old Values', 'New Values'];
    const rows = entries.map(e => [
      e.changed_at,
      e.table_name,
      e.action,
      e.record_id,
      e.changed_fields?.join(', ') || '',
      e.changed_by || '',
      e.old_values ? JSON.stringify(e.old_values) : '',
      e.new_values ? JSON.stringify(e.new_values) : '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [entries]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
            <p className="text-muted-foreground">
              {totalCount.toLocaleString()} records{filters.tableName !== 'all' ? ` in ${getTableDisplayName(filters.tableName!)}` : ''}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!entries.length}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-muted-foreground mb-1 block">Search</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search values..."
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    className="font-mono text-sm"
                  />
                  <Button size="icon" variant="outline" onClick={handleSearch}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="w-[180px]">
                <label className="text-xs text-muted-foreground mb-1 block">Table</label>
                <Select value={filters.tableName || 'all'} onValueChange={v => setFilters(f => ({ ...f, tableName: v, page: 1 }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tables</SelectItem>
                    {Object.entries(TABLE_DISPLAY_NAMES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[140px]">
                <label className="text-xs text-muted-foreground mb-1 block">Action</label>
                <Select value={filters.action || 'all'} onValueChange={v => setFilters(f => ({ ...f, action: v, page: 1 }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="INSERT">Created</SelectItem>
                    <SelectItem value="UPDATE">Updated</SelectItem>
                    <SelectItem value="DELETE">Deleted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[150px]">
                <label className="text-xs text-muted-foreground mb-1 block">From</label>
                <Input type="date" value={filters.dateFrom || ''} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value || undefined, page: 1 }))} />
              </div>
              <div className="w-[150px]">
                <label className="text-xs text-muted-foreground mb-1 block">To</label>
                <Input type="date" value={filters.dateTo || ''} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value || undefined, page: 1 }))} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={History}
            title="No audit entries yet"
            description="Activity will appear here as you use the platform."
          />
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="w-8" />
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Timestamp</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Table</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Action</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Record</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Changed Fields</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">User</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => {
                  const isExpanded = expandedRow === entry.id;
                  const actionStyle = ACTION_STYLES[entry.action];
                  const ActionIcon = actionStyle.icon;
                  const recordLabel = getRecordIdentifier(entry.table_name, entry.new_values || entry.old_values);

                  return (
                    <AuditRow
                      key={entry.id}
                      entry={entry}
                      isExpanded={isExpanded}
                      onToggle={() => setExpandedRow(isExpanded ? null : entry.id)}
                      actionStyle={actionStyle}
                      ActionIcon={ActionIcon}
                      recordLabel={recordLabel}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {filters.page} of {totalPages} ({totalCount.toLocaleString()} records)
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={filters.page <= 1} onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={filters.page >= totalPages} onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function AuditRow({ entry, isExpanded, onToggle, actionStyle, ActionIcon, recordLabel }: {
  entry: AuditLogEntry;
  isExpanded: boolean;
  onToggle: () => void;
  actionStyle: { label: string; variant: 'default' | 'secondary' | 'destructive' };
  ActionIcon: React.ComponentType<{ className?: string }>;
  recordLabel: string;
}) {
  return (
    <>
      <tr
        className="border-t border-border hover:bg-muted/30 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="px-2 py-2 text-center">
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </td>
        <td className="px-3 py-2 text-xs font-mono text-muted-foreground whitespace-nowrap">
          {format(new Date(entry.changed_at), 'dd/MM/yyyy HH:mm:ss')}
        </td>
        <td className="px-3 py-2 text-xs">{getTableDisplayName(entry.table_name)}</td>
        <td className="px-3 py-2">
          <Badge variant={actionStyle.variant} className="text-xs gap-1">
            <ActionIcon className="h-3 w-3" />
            {actionStyle.label}
          </Badge>
        </td>
        <td className="px-3 py-2 text-xs font-medium max-w-[200px] truncate">{recordLabel}</td>
        <td className="px-3 py-2 text-xs text-muted-foreground max-w-[200px] truncate">
          {entry.changed_fields?.join(', ') || '—'}
        </td>
        <td className="px-3 py-2 text-xs font-mono text-muted-foreground">
          {entry.changed_by?.slice(0, 8) || 'system'}
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-t border-border/50">
          <td colSpan={7} className="px-6 py-4 bg-muted/20">
            <AuditDetail entry={entry} />
          </td>
        </tr>
      )}
    </>
  );
}

function AuditDetail({ entry }: { entry: AuditLogEntry }) {
  if (entry.action === 'INSERT') {
    return (
      <div>
        <h4 className="text-xs font-semibold text-success mb-2">New record created</h4>
        <ValueList values={entry.new_values} />
      </div>
    );
  }

  if (entry.action === 'DELETE') {
    return (
      <div>
        <h4 className="text-xs font-semibold text-destructive mb-2">Record deleted</h4>
        <ValueList values={entry.old_values} className="text-destructive/80" />
      </div>
    );
  }

  // UPDATE — diff view
  const changedFields = entry.changed_fields || [];
  return (
    <div>
      <h4 className="text-xs font-semibold text-warning mb-2">Record updated — {changedFields.length} field{changedFields.length !== 1 ? 's' : ''} changed</h4>
      {changedFields.length > 0 ? (
        <table className="text-xs w-full max-w-2xl">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-1 pr-4 text-muted-foreground font-medium">Field</th>
              <th className="text-left py-1 pr-4 text-muted-foreground font-medium">Old Value</th>
              <th className="text-left py-1 text-muted-foreground font-medium">New Value</th>
            </tr>
          </thead>
          <tbody>
            {changedFields.map(field => (
              <tr key={field} className="border-b border-border/30">
                <td className="py-1.5 pr-4 font-medium">{humanizeFieldName(field)}</td>
                <td className="py-1.5 pr-4 text-destructive line-through">
                  {formatAuditValue(field, entry.old_values?.[field])}
                </td>
                <td className="py-1.5 text-success font-medium">
                  {formatAuditValue(field, entry.new_values?.[field])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-xs text-muted-foreground">No field-level diff available.</p>
      )}
    </div>
  );
}

function ValueList({ values, className }: { values: Record<string, unknown> | null; className?: string }) {
  if (!values) return <p className="text-xs text-muted-foreground">No data.</p>;

  const filteredEntries = Object.entries(values).filter(([k]) => !['id', 'org_id', 'created_at', 'updated_at'].includes(k));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
      {filteredEntries.map(([key, val]) => (
        <div key={key} className="flex gap-2 text-xs py-0.5">
          <span className="text-muted-foreground min-w-[140px]">{humanizeFieldName(key)}</span>
          <span className={cn('font-mono', className)}>{formatAuditValue(key, val)}</span>
        </div>
      ))}
    </div>
  );
}

export default AuditLogPage;
