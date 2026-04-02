import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Download, Send, History, PoundSterling, ArrowUpDown, Filter } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { SEVERITY } from '@/lib/design-tokens';
import {
  useRentSchedule,
  normalizeRentItem,
  type RentScheduleWithDetails,
  type RentStatus,
} from '@/hooks/useRentCollection';
import { exportRentRollCSV } from '@/lib/rentCsvExporter';
import RecordPaymentDialog from '@/components/rent/RecordPaymentDialog';
import SendReminderDialog from '@/components/rent/SendReminderDialog';

const formatGBP = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(v);

type SortField = 'property' | 'tenant' | 'room' | 'rent' | 'status' | 'lastPayment' | 'daysOutstanding';
type SortDir = 'asc' | 'desc';

const STATUS_CONFIG: Record<RentStatus, { label: string; severity: keyof typeof SEVERITY }> = {
  paid: { label: 'Paid', severity: 'success' },
  partial: { label: 'Partial', severity: 'warning' },
  overdue: { label: 'Overdue', severity: 'critical' },
  due: { label: 'Due', severity: 'info' },
  upcoming: { label: 'Upcoming', severity: 'neutral' },
  bad_debt: { label: 'Bad Debt', severity: 'critical' },
};

function StatusBadge({ status }: { status: RentStatus }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.upcoming;
  const classes = SEVERITY[config.severity];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${classes.badge}`}>
      {config.label}
    </span>
  );
}

interface RentRollTableProps {
  month: string;
  onViewHistory?: (item: RentScheduleWithDetails) => void;
}

export function RentRollTable({ month, onViewHistory }: RentRollTableProps) {
  const { data, isLoading } = useRentSchedule({ month });
  const items = data?.items || [];

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('property');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [paymentItem, setPaymentItem] = useState<RentScheduleWithDetails | null>(null);
  const [reminderItem, setReminderItem] = useState<RentScheduleWithDetails | null>(null);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const filteredAndSorted = useMemo(() => {
    let result = items.map(item => ({
      item,
      display: normalizeRentItem(item),
    }));

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(({ display }) =>
        display.propertyAddress.toLowerCase().includes(q) ||
        display.tenantName.toLowerCase().includes(q) ||
        display.roomName.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(({ item }) => item.status === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'property':
          cmp = a.display.propertyAddress.localeCompare(b.display.propertyAddress);
          break;
        case 'tenant':
          cmp = a.display.tenantName.localeCompare(b.display.tenantName);
          break;
        case 'room':
          cmp = a.display.roomName.localeCompare(b.display.roomName);
          break;
        case 'rent':
          cmp = a.item.rent_amount - b.item.rent_amount;
          break;
        case 'status': {
          const order: Record<RentStatus, number> = { overdue: 0, partial: 1, due: 2, upcoming: 3, paid: 4, bad_debt: 5 };
          cmp = (order[a.item.status] ?? 6) - (order[b.item.status] ?? 6);
          break;
        }
        case 'daysOutstanding': {
          const daysA = a.item.status === 'overdue' || a.item.status === 'partial'
            ? Math.floor((Date.now() - new Date(a.item.due_date).getTime()) / 86400000) : 0;
          const daysB = b.item.status === 'overdue' || b.item.status === 'partial'
            ? Math.floor((Date.now() - new Date(b.item.due_date).getTime()) / 86400000) : 0;
          cmp = daysA - daysB;
          break;
        }
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [items, search, statusFilter, sortField, sortDir]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAllSelected = filteredAndSorted.length > 0 && selectedIds.size === filteredAndSorted.length;

  const toggleAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSorted.map(({ item }) => item.id)));
    }
  };

  const selectedItems = filteredAndSorted
    .filter(({ item }) => selectedIds.has(item.id))
    .map(({ item }) => item);

  const handleExportCSV = () => {
    const toExport = selectedItems.length > 0 ? selectedItems : items;
    exportRentRollCSV(toExport);
  };

  const handleBulkRecordPayment = () => {
    if (selectedItems.length === 1) {
      setPaymentItem(selectedItems[0]);
    }
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => toggleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={cn('h-3 w-3', sortField === field ? 'text-foreground' : 'text-muted-foreground/50')} />
      </div>
    </TableHead>
  );

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 bg-muted rounded" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters & Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Input
            placeholder="Search property, tenant, or room..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-4"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="h-4 w-4 mr-1" />
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="due">Due</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2 ml-auto">
          {selectedItems.length === 1 && (
            <Button variant="outline" size="sm" onClick={handleBulkRecordPayment}>
              <PoundSterling className="h-4 w-4 mr-1" />
              Record Payment
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={isAllSelected ? true : selectedIds.size > 0 ? 'indeterminate' : false}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
              <SortHeader field="property">Property</SortHeader>
              <SortHeader field="tenant">Tenant</SortHeader>
              <SortHeader field="room">Room</SortHeader>
              <SortHeader field="rent">Monthly Rent</SortHeader>
              <SortHeader field="status">Status</SortHeader>
              <TableHead>Last Payment</TableHead>
              <SortHeader field="daysOutstanding">Days Outstanding</SortHeader>
              <TableHead className="w-[140px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No rent entries found for this period
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSorted.map(({ item, display }) => {
                const isSelected = selectedIds.has(item.id);
                const daysOutstanding =
                  item.status === 'overdue' || item.status === 'partial'
                    ? Math.max(0, Math.floor((Date.now() - new Date(item.due_date).getTime()) / 86400000))
                    : 0;

                return (
                  <TableRow
                    key={item.id}
                    className={cn(isSelected && 'bg-primary/5')}
                  >
                    <TableCell className="w-10">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelection(item.id)}
                        aria-label={`Select ${display.tenantName}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-sm">{display.propertyAddress}</TableCell>
                    <TableCell className="text-sm">{display.tenantName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{display.roomName}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatGBP(item.rent_amount)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.amount_paid > 0
                        ? format(new Date(item.updated_at), 'dd MMM yyyy')
                        : '—'}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {daysOutstanding > 0 ? (
                        <span className={cn(
                          'font-medium',
                          daysOutstanding > 60 ? 'text-red-600' :
                          daysOutstanding > 30 ? 'text-amber-600' :
                          'text-blue-600'
                        )}>
                          {daysOutstanding}d
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setPaymentItem(item)}
                          title="Record Payment"
                        >
                          <PoundSterling className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setReminderItem(item)}
                          title="Send Reminder"
                        >
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                        {onViewHistory && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => onViewHistory(item)}
                            title="View History"
                          >
                            <History className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Dialogs */}
      <RecordPaymentDialog
        item={paymentItem}
        open={!!paymentItem}
        onOpenChange={(open) => { if (!open) setPaymentItem(null); }}
      />
      <SendReminderDialog
        item={reminderItem}
        open={!!reminderItem}
        onOpenChange={(open) => { if (!open) setReminderItem(null); }}
      />
    </div>
  );
}
