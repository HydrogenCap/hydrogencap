import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowLeft, PoundSterling, AlertTriangle, CheckCircle2,
  Calendar, TrendingUp,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { LoadingState, EmptyState } from '@/components/common';
import {
  useTenancyLedger, usePaidOnTimeStats,
  useRentSchedule, normalizeRentItem, type LedgerEntry,
} from '@/hooks/useRentCollection';
import RecordPaymentDialog from '@/components/rent/RecordPaymentDialog';
import { cn } from '@/lib/utils';

const fmt = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(v);

export default function TenancyLedger() {
  const { tenancyId } = useParams<{ tenancyId: string }>();
  const navigate = useNavigate();
  const { data: ledger, isLoading } = useTenancyLedger(tenancyId);
  const { data: onTimeStats } = usePaidOnTimeStats(tenancyId);
  const { data: scheduleData } = useRentSchedule({ tenancyId });
  const scheduleItems = scheduleData?.items;
  const [showFuture, setShowFuture] = useState(false);
  const [showPayments, setShowPayments] = useState(true);
  const [showRent, setShowRent] = useState(true);
  const [paymentItem, setPaymentItem] = useState<any>(null);

  if (isLoading) return <AppLayout><LoadingState text="Loading ledger..." /></AppLayout>;
  if (!ledger || !tenancyId) return <AppLayout><EmptyState icon={PoundSterling} title="Ledger not found" description="No data for this tenancy." /></AppLayout>;

  // Get tenancy info from first schedule item using normalizeRentItem
  const firstItem = scheduleItems?.[0];
  const display = firstItem ? normalizeRentItem(firstItem) : null;
  const tenantName = display?.tenantName || 'Unknown Tenant';
  const roomName = display?.roomName || '';
  const propertyAddress = display?.propertyAddress || '';

  // Calculate summary stats from ledger
  const totalOverdue = ledger
    .filter(e => e.type === 'rent' && !e.is_future && (e.status === 'overdue' || e.status === 'partial'))
    .reduce((sum, e) => sum + e.amount, 0);
  
  const nextDue = ledger.find(e => e.type === 'rent' && e.is_future);
  const lastPaid = ledger.find(e => e.type === 'payment');

  // Filter entries
  const visibleEntries = ledger.filter((entry) => {
    if (!showFuture && entry.is_future) return false;
    if (!showPayments && entry.type === 'payment') return false;
    if (!showRent && entry.type === 'rent') return false;
    return true;
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/rent')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{propertyAddress} — {roomName}</h1>
            <p className="text-muted-foreground">{tenantName}</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-[hsl(348,70%,36%)] border-0 text-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white/80">Overdue</span>
                <AlertTriangle className="h-5 w-5 text-white/60" />
              </div>
              <p className="text-2xl font-bold">{fmt(Math.abs(totalOverdue))}</p>
            </CardContent>
          </Card>
          <Card className="bg-[hsl(43,70%,38%)] border-0 text-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white/80">
                  {nextDue ? `Due ${format(new Date(nextDue.date), 'dd MMM')}` : 'Next Due'}
                </span>
                <Calendar className="h-5 w-5 text-white/60" />
              </div>
              <p className="text-2xl font-bold">{nextDue ? fmt(nextDue.amount) : '—'}</p>
            </CardContent>
          </Card>
          <Card className="bg-[hsl(200,20%,45%)] border-0 text-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white/80">
                  {lastPaid ? `Paid ${format(new Date(lastPaid.date), 'dd MMM')}` : 'Last Paid'}
                </span>
                <CheckCircle2 className="h-5 w-5 text-white/60" />
              </div>
              <p className="text-2xl font-bold">{lastPaid ? fmt(Math.abs(lastPaid.amount)) : '—'}</p>
            </CardContent>
          </Card>
          <Card className="bg-[hsl(175,45%,30%)] border-0 text-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white/80">Paid on time</span>
                <TrendingUp className="h-5 w-5 text-white/60" />
              </div>
              <p className="text-2xl font-bold">{onTimeStats?.percentOnTime ?? 0}%</p>
              {(onTimeStats?.avgDaysLate ?? 0) > 0 && (
                <p className="text-xs text-white/60 mt-1">{onTimeStats?.avgDaysLate}d late avg</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch id="showFuture" checked={showFuture} onCheckedChange={setShowFuture} />
            <Label htmlFor="showFuture" className="text-sm">Show future rent</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="showPayments" checked={showPayments} onCheckedChange={setShowPayments} />
            <Label htmlFor="showPayments" className="text-sm">Show payments</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="showRent" checked={showRent} onCheckedChange={setShowRent} />
            <Label htmlFor="showRent" className="text-sm">Show rent due</Label>
          </div>
        </div>

        {/* Ledger Table */}
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Running Balance</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No entries match your filters
                  </TableCell>
                </TableRow>
              ) : (
                visibleEntries.map((entry) => (
                  <LedgerRow key={entry.id} entry={entry} />
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Action Toolbar */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => {
            if (firstItem) setPaymentItem(firstItem);
          }}>
            <PoundSterling className="h-4 w-4 mr-2" />
            Log Payment
          </Button>
        </div>

        <RecordPaymentDialog
          item={paymentItem}
          open={!!paymentItem}
          onOpenChange={(open) => { if (!open) setPaymentItem(null); }}
        />
      </div>
    </AppLayout>
  );
}

function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const isPayment = entry.type === 'payment';
  const statusBadge = getStatusBadge(entry);

  return (
    <TableRow className={cn(isPayment && 'bg-green-50/50 dark:bg-green-950/10')}>
      <TableCell className={cn('tabular-nums', isPayment && 'text-green-600')}>
        {format(new Date(entry.date), 'dd MMM yyyy')}
      </TableCell>
      <TableCell>{entry.description}</TableCell>
      <TableCell>{statusBadge}</TableCell>
      <TableCell className={cn('text-right tabular-nums font-medium', isPayment ? 'text-green-600' : '')}>
        {isPayment ? `−${fmt(Math.abs(entry.amount))}` : fmt(entry.amount)}
      </TableCell>
      <TableCell className={cn(
        'text-right tabular-nums',
        entry.is_future ? 'text-muted-foreground' : entry.running_balance > 0 ? 'text-destructive font-bold' : ''
      )}>
        {entry.is_future ? '' : fmt(entry.running_balance)}
      </TableCell>
      <TableCell>
        {entry.rent_schedule_id && entry.type === 'rent' && (
          <Link to={`/rent/${entry.rent_schedule_id}`} className="text-xs text-primary hover:underline">
            View
          </Link>
        )}
      </TableCell>
    </TableRow>
  );
}

function getStatusBadge(entry: LedgerEntry) {
  if (entry.is_future || entry.type === 'payment') return null;

  switch (entry.status) {
    case 'paid':
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">Paid</Badge>;
    case 'overdue':
      return <Badge variant="destructive">Overdue</Badge>;
    case 'partial':
      return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">Partial</Badge>;
    case 'due':
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">Due</Badge>;
    case 'bad_debt':
      return <Badge variant="destructive">Bad Debt</Badge>;
    default:
      return null;
  }
}