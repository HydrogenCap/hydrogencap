import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PoundSterling, Download, Building2, Users, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useArrearsAging, useMonthSummary, useRentSchedule } from '@/hooks/useRentCollection';
import { LoadingState } from '@/components/common';
import { RentSummaryCards } from '@/components/rent/RentSummaryCards';
import { ArrearsAgingTable } from '@/components/rent/ArrearsAgingTable';
import RecordPaymentDialog from '@/components/rent/RecordPaymentDialog';
import { exportRentRollCSV, exportArrearsCSV } from '@/lib/rentCsvExporter';
import { cn } from '@/lib/utils';
import { format, startOfMonth } from 'date-fns';

type Grouping = 'property' | 'tenancy' | 'none';

export default function RentCollection() {
  const navigate = useNavigate();
  const [grouping, setGrouping] = useState<Grouping>('property');
  const [search, setSearch] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('all');

  const { data: monthSummary, isLoading: summaryLoading } = useMonthSummary();
  const { data: arrearsData, isLoading: arrearsLoading } = useArrearsAging();

  // For exports — fetch current month schedule
  const monthStr = format(startOfMonth(new Date()), 'yyyy-MM');
  const { data: currentMonthSchedule } = useRentSchedule({ month: monthStr });

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
      if (search) {
        const q = search.toLowerCase();
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
  }, [arrearsData, propertyFilter, search]);

  if (isLoading) return <AppLayout><LoadingState text="Loading rent collection..." /></AppLayout>;

  const groupingOptions: { value: Grouping; label: string; icon: React.ElementType }[] = [
    { value: 'property', label: 'Property', icon: Building2 },
    { value: 'tenancy', label: 'Tenancy', icon: Users },
    { value: 'none', label: 'No Grouping', icon: List },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
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

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-lg">
            <Input
              placeholder="Search by property, tenant, or room..."
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
        <ArrearsAgingTable data={filteredArrears} grouping={grouping} />
      </div>
    </AppLayout>
  );
}
