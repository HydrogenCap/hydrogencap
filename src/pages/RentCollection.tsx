import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PoundSterling, Calendar, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, Clock, TrendingUp, Eye } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRentSchedule, useArrears, RentStatus, RentScheduleWithDetails } from '@/hooks/useRentCollection';
import { LoadingState, EmptyState } from '@/components/common';
import RecordPaymentDialog from '@/components/rent/RecordPaymentDialog';
import PaymentFilters from '@/components/rent/PaymentFilters';

const statusConfig: Record<RentStatus, { label: string; color: string; icon: React.ElementType }> = {
  upcoming: { label: 'Upcoming', color: 'bg-gray-100 text-gray-800', icon: Clock },
  due: { label: 'Due Today', color: 'bg-blue-100 text-blue-800', icon: Calendar },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  partial: { label: 'Partial', color: 'bg-amber-100 text-amber-800', icon: AlertTriangle },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-800', icon: AlertTriangle },
};

function RentScheduleRow({ item, onRecordPayment, onView }: { item: RentScheduleWithDetails; onRecordPayment: () => void; onView: () => void }) {
  const status = statusConfig[item.status];
  const StatusIcon = status.icon;

  return (
    <Card className={item.status === 'overdue' ? 'border-destructive/30' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </span>
              <span className="text-sm text-muted-foreground">
                Due: {format(new Date(item.due_date), 'dd MMM yyyy')}
              </span>
            </div>
            <h4 className="font-medium">
              {item.tenancy.tenant.first_name} {item.tenancy.tenant.last_name}
            </h4>
            <p className="text-sm text-muted-foreground">
              {item.tenancy.room.room_name} • {item.tenancy.property.address_line}
            </p>
          </div>

          <div className="text-right shrink-0">
            <p className="text-lg font-semibold">£{item.rent_amount.toLocaleString()}</p>
            {item.amount_paid > 0 && (
              <p className="text-sm text-green-600">Paid: £{item.amount_paid.toLocaleString()}</p>
            )}
            {item.amount_outstanding > 0 && item.status !== 'upcoming' && (
              <p className="text-sm text-destructive">Owed: £{item.amount_outstanding.toLocaleString()}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={onView}>
              <Eye className="h-4 w-4 mr-1" /> View
            </Button>
            {item.status !== 'paid' && (
              <Button size="sm" onClick={onRecordPayment}>
                Record Payment
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RentCollection() {
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()));
  const [paymentItem, setPaymentItem] = useState<RentScheduleWithDetails | null>(null);
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RentStatus | 'all'>('all');
  const [propertyFilter, setPropertyFilter] = useState('all');

  const monthStr = format(selectedMonth, 'yyyy-MM');
  const { data: schedule, isLoading } = useRentSchedule({ month: monthStr });
  const { data: arrears } = useArrears();

  // Extract unique properties for filter dropdown
  const properties = useMemo(() => {
    if (!schedule) return [];
    const map = new Map<string, { id: string; address_line: string }>();
    schedule.forEach(item => {
      if (!map.has(item.tenancy.property.id)) {
        map.set(item.tenancy.property.id, {
          id: item.tenancy.property.id,
          address_line: item.tenancy.property.address_line,
        });
      }
    });
    return Array.from(map.values());
  }, [schedule]);

  // Apply filters
  const filteredSchedule = useMemo(() => {
    if (!schedule) return [];
    return schedule.filter(item => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (propertyFilter !== 'all' && item.tenancy.property.id !== propertyFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const tenantName = `${item.tenancy.tenant.first_name} ${item.tenancy.tenant.last_name}`.toLowerCase();
        const address = item.tenancy.property.address_line.toLowerCase();
        const ref = ((item as any).payment_reference || '').toLowerCase();
        if (!tenantName.includes(q) && !address.includes(q) && !ref.includes(q)) return false;
      }
      return true;
    });
  }, [schedule, statusFilter, propertyFilter, search]);

  const summary = useMemo(() => {
    if (!filteredSchedule.length && !schedule?.length) return null;
    const items = filteredSchedule;
    const totalExpected = items.reduce((sum, item) => sum + item.rent_amount + item.additional_charges, 0);
    const totalReceived = items.reduce((sum, item) => sum + item.amount_paid, 0);
    const totalOutstanding = items.reduce((sum, item) => sum + item.amount_outstanding, 0);
    return {
      totalExpected,
      totalReceived,
      totalOutstanding,
      collectionRate: totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0,
      counts: {
        paid: items.filter(s => s.status === 'paid').length,
        partial: items.filter(s => s.status === 'partial').length,
        overdue: items.filter(s => s.status === 'overdue').length,
        due: items.filter(s => s.status === 'due').length,
        upcoming: items.filter(s => s.status === 'upcoming').length,
      }
    };
  }, [filteredSchedule, schedule]);

  if (isLoading) return <LoadingState text="Loading rent schedule..." />;

  const renderRows = (items: RentScheduleWithDetails[]) =>
    items.length === 0 ? (
      <EmptyState icon={PoundSterling} title="No payments" description="No payments match your filters" />
    ) : (
      items.map(item => (
        <RentScheduleRow
          key={item.id}
          item={item}
          onRecordPayment={() => setPaymentItem(item)}
          onView={() => navigate(`/rent/${item.id}`)}
        />
      ))
    );

  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PoundSterling className="h-6 w-6" />
            Rent Collection
          </h1>
          <p className="text-muted-foreground">Track rent payments and arrears</p>
        </div>
      </div>

      {/* Month Navigator */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-semibold min-w-[200px] text-center">
          {format(selectedMonth, 'MMMM yyyy')}
        </h2>
        <Button variant="outline" size="icon" onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Filters */}
      <PaymentFilters
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        propertyFilter={propertyFilter}
        onPropertyFilterChange={setPropertyFilter}
        properties={properties}
      />

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Expected</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">£{summary.totalExpected.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-green-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Received</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">£{summary.totalReceived.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className={summary.totalOutstanding > 0 ? 'border-destructive/30' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${summary.totalOutstanding > 0 ? 'text-destructive' : ''}`}>
                £{summary.totalOutstanding.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                Collection Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.collectionRate}%</p>
              <Progress value={summary.collectionRate} className="mt-2" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Arrears Alert */}
      {arrears && arrears.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium">
                  {arrears.length} tenant{arrears.length > 1 ? 's' : ''} in arrears
                </p>
                <p className="text-sm text-muted-foreground">
                  Total outstanding: £{arrears.reduce((sum, a) => sum + a.amount_outstanding, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule List */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({filteredSchedule.length})</TabsTrigger>
          <TabsTrigger value="action">
            Needs Action ({(summary?.counts.overdue || 0) + (summary?.counts.partial || 0) + (summary?.counts.due || 0)})
          </TabsTrigger>
          <TabsTrigger value="paid">Paid ({summary?.counts.paid || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4 space-y-3">
          {renderRows(filteredSchedule)}
        </TabsContent>

        <TabsContent value="action" className="mt-4 space-y-3">
          {renderRows(filteredSchedule.filter(s => ['overdue', 'partial', 'due'].includes(s.status)))}
        </TabsContent>

        <TabsContent value="paid" className="mt-4 space-y-3">
          {renderRows(filteredSchedule.filter(s => s.status === 'paid'))}
        </TabsContent>
      </Tabs>

      <RecordPaymentDialog
        item={paymentItem}
        open={!!paymentItem}
        onOpenChange={(open) => { if (!open) setPaymentItem(null); }}
      />
    </div>
  );
}
