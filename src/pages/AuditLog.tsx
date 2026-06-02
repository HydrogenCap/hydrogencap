import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Download, Search, ChevronDown, ChevronRight, Plus, Pencil, Trash2, History, X, User, Globe } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useActivitySidebar } from '@/state/activitySidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { useAuditLog, fetchAuditLogForExport } from '@/hooks/useAuditLog';
import { useOrgMemberLookup, formatMember } from '@/hooks/useOrgMemberLookup';
import {
  type AuditLogEntry, type AuditLogFilters,
  TABLE_DISPLAY_NAMES, getTableDisplayName, getRecordIdentifier,
  humanizeFieldName, formatAuditValue,
} from '@/lib/auditLogTypes';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const PAGE_SIZE = 50;

const ACTION_STYLES: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive'; icon: React.ComponentType<{ className?: string }> }> = {
  INSERT: { label: 'Created', variant: 'default', icon: Plus },
  UPDATE: { label: 'Updated', variant: 'secondary', icon: Pencil },
  DELETE: { label: 'Deleted', variant: 'destructive', icon: Trash2 },
};

export function AuditPanel() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState<AuditLogFilters>(() => ({
    page: 1,
    pageSize: PAGE_SIZE,
    dateFrom: searchParams.get('from') || undefined,
    dateTo: searchParams.get('to') || undefined,
    tableName: searchParams.get('table') || 'all',
    action: searchParams.get('action') || 'all',
    userId: searchParams.get('user') || 'all',
    recordId: searchParams.get('record') || undefined,
    search: searchParams.get('q') || '',
  }));
  const [searchInput, setSearchInput] = useState(filters.search || '');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Keep URL in sync for shareable links
  useEffect(() => {
    const next = new URLSearchParams();
    if (filters.tableName && filters.tableName !== 'all') next.set('table', filters.tableName);
    if (filters.action && filters.action !== 'all') next.set('action', filters.action);
    if (filters.userId && filters.userId !== 'all') next.set('user', filters.userId);
    if (filters.recordId) next.set('record', filters.recordId);
    if (filters.dateFrom) next.set('from', filters.dateFrom);
    if (filters.dateTo) next.set('to', filters.dateTo);
    if (filters.search) next.set('q', filters.search);
    setSearchParams(next, { replace: true });
  }, [filters, setSearchParams]);

  const { data, isLoading } = useAuditLog(filters);
  const { data: memberMap } = useOrgMemberLookup();
  const entries = useMemo(() => data?.entries || [], [data?.entries]);
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleSearch = useCallback(() => {
    setFilters(f => ({ ...f, search: searchInput, page: 1 }));
  }, [searchInput]);

  const clearRecordFilter = useCallback(() => {
    setFilters(f => ({ ...f, recordId: undefined, page: 1 }));
  }, []);

  const exportCSV = useCallback(async () => {
    setExporting(true);
    try {
      const rowsData = await fetchAuditLogForExport(filters);
      if (!rowsData.length) {
        toast({ title: 'Nothing to export', description: 'No entries match the current filters.' });
        return;
      }
      const headers = ['Timestamp', 'Table', 'Action', 'Record ID', 'Changed Fields', 'Changed By', 'Context', 'IP', 'Old Values', 'New Values'];
      const rows = rowsData.map(e => [
        e.changed_at,
        e.table_name,
        e.action,
        e.record_id,
        e.changed_fields?.join(', ') || '',
        formatMember(memberMap, e.changed_by),
        e.context || '',
        e.ip_address || '',
        e.old_values ? JSON.stringify(e.old_values) : '',
        e.new_values ? JSON.stringify(e.new_values) : '',
      ]);
      const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Exported', description: `${rowsData.length.toLocaleString()} entries saved.` });
    } catch (err) {
      toast({ title: 'Export failed', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  }, [filters, memberMap]);

  const memberOptions = useMemo(() => {
    if (!memberMap) return [];
    return Array.from(memberMap.values()).sort((a, b) =>
      (a.full_name || a.email).localeCompare(b.full_name || b.email)
    );
  }, [memberMap]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
          <p className="text-muted-foreground">
            {totalCount.toLocaleString()} records{filters.tableName && filters.tableName !== 'all' ? ` in ${getTableDisplayName(filters.tableName)}` : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={exporting || !totalCount}>
          <Download className="h-4 w-4 mr-2" /> {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      </div>

      {filters.recordId && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Filtering by record</span>
          <code className="font-mono text-xs">{filters.recordId}</code>
          <Button variant="ghost" size="sm" className="ml-auto h-7 px-2" onClick={clearRecordFilter}>
            <X className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground mb-1 block">Search values</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Search old/new values…"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  className="font-mono text-sm"
                />
                <Button aria-label="Search" size="icon" variant="outline" onClick={handleSearch}>
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
            <div className="w-[200px]">
              <label className="text-xs text-muted-foreground mb-1 block">User</label>
              <Select value={filters.userId || 'all'} onValueChange={v => setFilters(f => ({ ...f, userId: v, page: 1 }))}>
                <SelectTrigger><SelectValue placeholder="Anyone" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Anyone</SelectItem>
                  <SelectItem value="__system__">System / automation</SelectItem>
                  {memberOptions.map(m => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.full_name || m.email}
                    </SelectItem>
                  ))}
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
          title="No audit entries match"
          description="Try widening your date range or clearing filters."
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
                const userLabel = formatMember(memberMap, entry.changed_by);
                return (
                  <AuditRow
                    key={entry.id}
                    entry={entry}
                    isExpanded={isExpanded}
                    onToggle={() => setExpandedRow(isExpanded ? null : entry.id)}
                    actionStyle={actionStyle}
                    ActionIcon={ActionIcon}
                    recordLabel={recordLabel}
                    userLabel={userLabel}
                    onFilterRecord={(id) => setFilters(f => ({ ...f, recordId: id, page: 1 }))}
                    onFilterUser={(id) => setFilters(f => ({ ...f, userId: id || '__system__', page: 1 }))}
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
  );
}

function AuditRow({ entry, isExpanded, onToggle, actionStyle, ActionIcon, recordLabel, userLabel, onFilterRecord, onFilterUser }: {
  entry: AuditLogEntry;
  isExpanded: boolean;
  onToggle: () => void;
  actionStyle: { label: string; variant: 'default' | 'secondary' | 'destructive' };
  ActionIcon: React.ComponentType<{ className?: string }>;
  recordLabel: string;
  userLabel: string;
  onFilterRecord: (id: string) => void;
  onFilterUser: (id: string | null) => void;
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
        <td className="px-3 py-2 text-xs font-medium max-w-[220px] truncate" title={recordLabel}>{recordLabel}</td>
        <td className="px-3 py-2 text-xs text-muted-foreground max-w-[200px] truncate" title={entry.changed_fields?.join(', ')}>
          {entry.changed_fields?.join(', ') || '—'}
        </td>
        <td className="px-3 py-2 text-xs text-muted-foreground max-w-[160px] truncate" title={userLabel}>
          {userLabel}
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-t border-border/50">
          <td colSpan={7} className="px-6 py-4 bg-muted/20">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs">
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); onFilterRecord(entry.record_id); }}>
                  Show all changes to this record
                </Button>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); onFilterUser(entry.changed_by); }}>
                  <User className="h-3 w-3 mr-1" /> Filter by {userLabel}
                </Button>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span><span className="font-mono">{entry.record_id}</span></span>
                {entry.context && <span>Source: <Badge variant="outline" className="text-xs">{entry.context}</Badge></span>}
                {entry.ip_address && <span className="inline-flex items-center gap-1"><Globe className="h-3 w-3" />{entry.ip_address}</span>}
                {entry.session_id && <span>Session: <code className="font-mono">{entry.session_id.slice(0, 8)}</code></span>}
              </div>
              <AuditDetail entry={entry} />
            </div>
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

export default function AuditLogPage() {
  const { openSidebar } = useActivitySidebar();
  useEffect(() => { openSidebar('audit'); }, [openSidebar]);
  return (
    <AppLayout>
      <AuditPanel />
    </AppLayout>
  );
}
