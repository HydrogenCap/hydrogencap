import { useState, useMemo, useEffect, useCallback, useDeferredValue } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PoundSterling, Download, Building2, Users, List, Clock, ChevronRight, FileSpreadsheet, Link2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useArrearsAging, useMonthSummary, useRentSchedule, useRentTrend, type RentScheduleWithDetails, type RentStatus } from '@/hooks/useRentCollection';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useTenancies, type TenancyWithDetails } from '@/hooks/useTenancies';
import { KpiCardSkeleton, TableRowSkeleton } from '@/components/common';
import { RentSummaryCards } from '@/components/rent/RentSummaryCards';
import { ArrearsAgingTable } from '@/components/rent/ArrearsAgingTable';
import BulkActionToolbar from '@/components/rent/BulkActionToolbar';
import BulkMarkPaidDialog from '@/components/rent/BulkMarkPaidDialog';
import BulkWriteOffDialog from '@/components/rent/BulkWriteOffDialog';
import BulkAddNoteDialog from '@/components/rent/BulkAddNoteDialog';
import BulkSendReminderDialog from '@/components/rent/BulkSendReminderDialog';
import { exportRentRollCSV } from '@/lib/rentCsvExporter';
import { BankStatementImportDialog } from '@/components/rent/BankStatementImportDialog';
import { ArrearsRiskPanel } from '@/components/rent/ArrearsRiskPanel';
import { cn } from '@/lib/utils';
import { format, startOfMonth } from 'date-fns';

type Grouping = 'property' | 'tenancy' | 'none';

export default function RentCollection() {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const navigate = useNavigate();
  const [grouping, setGrouping] = useState<Grouping>('property');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [propertyFilter, setPropertyFilter] = useState('all');

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialog states
  const [markPaidMode, setMarkPaidMode] = useState<'on_time' | 'late' | null>(null);
  const [showWriteOff, setShowWriteOff] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [showSendReminder, setShowSendReminder] = useState(false);

  const { data: monthSummary, isLoading: summaryLoading } = useMonthSummary();
  const { data: trendData } = useRentTrend(12);
  const { data: arrearsData, isLoading: arrearsLoading } = useArrearsAging();
  const { data: allTenancies } = useTenancies();

  // Tenancies expiring within 90 days or already expired but still active
  const expiringTenancies = useMemo(() => {
    if (!allTenancies) return [];
    const now = new Date();
    const ninetyDays = new Date(now.getTime() + 90 * 86400000);

    return allTenancies
      .filter(t =>
        (t.status === 'active' || t.status === 'notice') &&
        t.end_date &&
        new Date(t.end_date) <= ninetyDays
      )
      .sort((a, b) => new Date(a.end_date!).getTime() - new Date(b.end_date!).getTime());
  }, [allTenancies]);

  // For exports — fetch current month schedule
  const monthStr = format(startOfMonth(new Date()), 'yyyy-MM');
  const { data: currentMonthData } = useRentSchedule({ month: monthStr });
  const currentMonthSchedule = currentMonthData?.items;

  const isLoading = summaryLoading || arrearsLoading;

  // Extract properties for filter
  const properties = useMemo(() => {
    if (!arrearsData) return [];
    return arrearsData.map(r => ({ id: r.property_id, address_line: r.property_address }));
  }, [arrearsData]);

  // Filter arrears data
  const filteredArrears = useMemo(() => {
    if (!arrearsData) return [];
    return arrearsData.filter(row => {
      if (propertyFilter !== 'all' && row.property_id !== propertyFilter) return false;
      if (deferredSearch) {
        const q = deferredSearch.toLowerCase();
        const searchable = [
          row.property_address,
          row.property_postcode,
          ...row.tenancies.map(t => t.tenant_name),
          ...row.tenancies.map(t => t.room_name),
        ].filter(Boolean).join(' ').toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  }, [arrearsData, propertyFilter, deferredSearch]);

  // All schedule items from filtered data (for selection)
  const allScheduleItems = useMemo(() => {
    return filteredArrears.flatMap(r =>
      r.tenancies.flatMap(t => t.schedule_items)
    );
  }, [filteredArrears]);

  // Selected items derived
  const selectedItems = useMemo(() =>
    allScheduleItems.filter(item => selectedIds.has(item.id)),
    [allScheduleItems, selectedIds]
  );

  const selectedTotal = useMemo(() =>
    selectedItems.reduce((sum, item) => sum + item.amount_outstanding, 0),
    [selectedItems]
  );

  const isAllSelected = allScheduleItems.length > 0 && selectedIds.size === allScheduleItems.length;
  const isPartiallySelected = selectedIds.size > 0 && selectedIds.size < allScheduleItems.length;

  // Selection helpers
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allScheduleItems.map(item => item.id)));
    }
  }, [isAllSelected, allScheduleItems]);

  const selectByStatus = useCallback((statuses: RentStatus[]) => {
    const ids = allScheduleItems
      .filter(item => statuses.includes(item.status))
      .map(item => item.id);
    setSelectedIds(new Set(ids));
  }, [allScheduleItems]);

  const deselectAll = useCallback(() => setSelectedIds(new Set()), []);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [search, propertyFilter, grouping]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedIds(new Set(allScheduleItems.map(item => item.id)));
      }
      if (e.key === 'Escape' && selectedIds.size > 0) {
        deselectAll();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allScheduleItems, selectedIds.size, deselectAll]);

  // Quick-select counts
  const dueCount = allScheduleItems.filter(i => i.status === 'due').length;
  const overdueCount = allScheduleItems.filter(i => i.status === 'overdue' || i.status === 'partial').length;
  const unpaidCount = allScheduleItems.filter(i => i.status !== 'paid' && i.status !== 'bad_debt').length;

  if (isLoading) return (
    <AppLayout>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <KpiCardSkeleton key={i} />)}
        </div>
        <TableRowSkeleton columns={6} rows={8} />
      </div>
    </AppLayout>
  );

  const groupingOptions: { value: Grouping; label: string; icon: React.ElementType }[] = [
    { value: 'property', label: 'Property', icon: Building2 },
    { value: 'tenancy', label: 'Tenancy', icon: Users },
    { value: 'none', label: 'No Grouping', icon: List },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <PoundSterling className="h-6 w-6" />
              Rent Collection
            </h1>
            <p className="text-muted-foreground">Track rent payments and arrears</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              Import Statement
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/rent/reconciliation')}>
              <Link2 className="h-4 w-4 mr-1" />
              Reconciliation
            </Button>
            {currentMonthSchedule && (
              <Button variant="outline" size="sm" onClick={() => exportRentRollCSV(currentMonthSchedule)}>
                <Download className="h-4 w-4 mr-1" />
                Export Rent Roll
              </Button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        {monthSummary && <RentSummaryCards data={monthSummary} />}

        {/* 12-Month Collection Trend */}
        {trendData && trendData.length > 1 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">12-Month Collection Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis
                    tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    width={48}
                  />
                  <Tooltip
                    formatter={(v: number) =>
                      new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(v)
                    }
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      color: 'hsl(var(--foreground))',
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="due" name="Rent Due" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground) / 0.15)" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="paid" name="Collected" stroke="hsl(142 76% 36%)" fill="hsl(142 76% 36% / 0.2)" strokeWidth={2} />
                  <Area type="monotone" dataKey="outstanding" name="Outstanding" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive) / 0.15)" strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Tenancy Expiry Alerts */}
        {expiringTenancies.length > 0 && (
          <Card className="border-amber-200 dark:border-amber-800/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                Tenancy Renewals Due
                <Badge variant="secondary">{expiringTenancies.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {expiringTenancies.map(tenancy => {
                const daysLeft = tenancy.end_date
                  ? Math.ceil((new Date(tenancy.end_date).getTime() - Date.now()) / 86400000)
                  : null;
                const isExpired = daysLeft !== null && daysLeft < 0;
                const isCritical = daysLeft !== null && daysLeft <= 30;

                return (
                  <div
                    key={tenancy.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/tenants/${tenancy.tenant_id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {tenancy.tenant.first_name} {tenancy.tenant.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tenancy.room?.room_name ? `${tenancy.room.room_name} · ` : ''}
                        {tenancy.property.address_line}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {tenancy.end_date && (
                        <>
                          <p className={`text-sm font-medium ${isExpired ? 'text-destructive' : isCritical ? 'text-amber-600' : 'text-muted-foreground'}`}>
                            {isExpired
                              ? `Expired ${Math.abs(daysLeft!)} days ago`
                              : `${daysLeft} days left`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(tenancy.end_date), 'dd MMM yyyy')}
                          </p>
                        </>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground ml-2 shrink-0" />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Arrears Risk Assessment */}
        <ArrearsRiskPanel />

        {/* Grouping Tabs */}
        <div className="flex items-center gap-1 border border-border rounded-lg overflow-hidden w-fit">
          {groupingOptions.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => setGrouping(opt.value)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors',
                  grouping === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Quick-select bar */}
        {allScheduleItems.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button
              onClick={toggleAll}
              className="text-primary hover:underline font-medium"
            >
              {isAllSelected ? 'Deselect all' : 'Select all'}
            </button>
            {dueCount > 0 && (
              <>
                <span className="text-muted-foreground">|</span>
                <button
                  onClick={() => selectByStatus(['due'])}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Select all due ({dueCount})
                </button>
              </>
            )}
            {overdueCount > 0 && (
              <>
                <span className="text-muted-foreground">|</span>
                <button
                  onClick={() => selectByStatus(['overdue', 'partial'])}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Select all overdue ({overdueCount})
                </button>
              </>
            )}
            {unpaidCount > 0 && (
              <>
                <span className="text-muted-foreground">|</span>
                <button
                  onClick={() => selectByStatus(['due', 'overdue', 'partial', 'upcoming'])}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Select all unpaid ({unpaidCount})
                </button>
              </>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-lg">
            <Input
              placeholder="Search by property, tenant, or room..."
              aria-label="Search rent collection"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-4"
            />
          </div>
          <Select value={propertyFilter} onValueChange={setPropertyFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All properties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All properties</SelectItem>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.address_line}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Arrears Aging Table */}
        <ArrearsAgingTable
          data={filteredArrears}
          grouping={grouping}
          selectedIds={selectedIds}
          onToggleSelection={toggleSelection}
          onToggleAll={toggleAll}
          isAllSelected={isAllSelected}
          isPartiallySelected={isPartiallySelected}
        />

        {/* Bulk Action Toolbar */}
        {selectedIds.size > 0 && (
          <BulkActionToolbar
            selectedItems={selectedItems}
            selectedTotal={selectedTotal}
            onMarkPaidOnTime={() => setMarkPaidMode('on_time')}
            onMarkPaidLate={() => setMarkPaidMode('late')}
            onSendReminder={() => setShowSendReminder(true)}
            onWriteOffBadDebt={() => setShowWriteOff(true)}
            onAddNote={() => setShowAddNote(true)}
            onExportSelected={() => {
              exportRentRollCSV(selectedItems);
              deselectAll();
            }}
            onClearSelection={deselectAll}
            isProcessing={false}
          />
        )}

        {/* Dialogs */}
        {markPaidMode && (
          <BulkMarkPaidDialog
            items={selectedItems}
            open={!!markPaidMode}
            onOpenChange={(open) => { if (!open) setMarkPaidMode(null); }}
            mode={markPaidMode}
            onSuccess={deselectAll}
          />
        )}

        <BulkWriteOffDialog
          items={selectedItems}
          open={showWriteOff}
          onOpenChange={setShowWriteOff}
          onSuccess={deselectAll}
        />

        <BulkAddNoteDialog
          items={selectedItems}
          open={showAddNote}
          onOpenChange={setShowAddNote}
          onSuccess={deselectAll}
        />

        <BulkSendReminderDialog
          items={selectedItems}
          open={showSendReminder}
          onOpenChange={setShowSendReminder}
          onSuccess={deselectAll}
        />

        <BankStatementImportDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          onSuccess={() => navigate('/rent/reconciliation')}
        />
      </div>
    </AppLayout>
  );
}
