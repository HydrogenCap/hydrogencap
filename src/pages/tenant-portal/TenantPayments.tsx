import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  PoundSterling, Download, AlertCircle, CheckCircle2, Clock, Receipt,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TenantPortalLayoutV2 } from '@/components/tenant-portal/TenantPortalLayoutV2';
import { useTenantPortalSession } from '@/hooks/useTenantPortalSession';
import { supabase } from '@/integrations/supabase/client';
import { LoadingState } from '@/components/common/LoadingState';
import { formatGBP } from '@/lib/calculations';

const statusColors: Record<string, string> = {
  paid: 'bg-primary/10 text-primary border-primary/30',
  partial: 'bg-warning/10 text-warning border-warning/30',
  overdue: 'bg-destructive/10 text-destructive border-destructive/30',
  due: 'bg-accent text-accent-foreground',
  upcoming: 'bg-muted text-muted-foreground',
};

export default function TenantPayments() {
  const { tenancyId, canViewRent } = useTenantPortalSession();

  // Rent schedule
  const { data: schedule, isLoading: scheduleLoading } = useQuery({
    queryKey: ['tenant-payments-schedule', tenancyId],
    queryFn: async () => {
      if (!tenancyId) return [];
      const { data, error } = await supabase
        .from('rent_schedule')
        .select('*')
        .eq('tenancy_id', tenancyId)
        .order('due_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: canViewRent && !!tenancyId,
  });

  // Payment records
  const { data: payments } = useQuery({
    queryKey: ['tenant-payments-history', tenancyId],
    queryFn: async () => {
      if (!tenancyId) return [];
      const { data, error } = await supabase
        .from('rent_payments')
        .select('*')
        .eq('tenancy_id', tenancyId)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: canViewRent && !!tenancyId,
  });

  // Calculate totals
  const totalDue = schedule?.reduce((s, r) => s + r.rent_amount, 0) || 0;
  const totalPaid = schedule?.reduce((s, r) => s + (r.amount_paid || 0), 0) || 0;
  const totalOutstanding = schedule?.reduce((s, r) => s + (r.amount_outstanding || 0), 0) || 0;
  const overdueCount = schedule?.filter(r => r.status === 'overdue').length || 0;

  return (
    <TenantPortalLayoutV2>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PoundSterling className="h-6 w-6 text-primary" />
            Payment History
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your rent payments and schedule
          </p>
        </div>

        {scheduleLoading ? (
          <LoadingState text="Loading payment history..." />
        ) : (
          <>
            {/* Balance overview */}
            <Card className={totalOutstanding > 0 ? 'border-destructive/30' : 'border-primary/30'}>
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {totalOutstanding > 0 ? (
                      <>
                        <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                          <AlertCircle className="h-5 w-5 text-destructive" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                          <p className="text-2xl font-bold text-destructive">{formatGBP(totalOutstanding)}</p>
                          {overdueCount > 0 && (
                            <p className="text-xs text-destructive">{overdueCount} overdue payment(s)</p>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Balance</p>
                          <p className="text-2xl font-bold text-primary">{formatGBP(0)}</p>
                          <p className="text-xs text-primary">All payments up to date</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary stats */}
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">Total Charged</p>
                  <p className="text-xl font-bold">{formatGBP(totalDue)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">Total Paid</p>
                  <p className="text-xl font-bold text-primary">{formatGBP(totalPaid)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">Outstanding</p>
                  <p className={`text-xl font-bold ${totalOutstanding > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {formatGBP(totalOutstanding)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">Periods Paid</p>
                  <p className="text-xl font-bold">
                    {schedule?.filter(r => r.status === 'paid').length || 0}
                    <span className="text-sm font-normal text-muted-foreground"> / {schedule?.length || 0}</span>
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Payments table */}
            {payments && payments.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    Payments Received
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto -mx-6">
                    <div className="min-w-[500px] px-6">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Reference</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payments.map((payment) => (
                            <TableRow key={payment.id}>
                              <TableCell className="font-medium text-sm">
                                {format(new Date(payment.payment_date), 'dd MMM yyyy')}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatGBP(payment.amount)}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground capitalize">
                                {(payment.payment_method || 'N/A').replace('_', ' ')}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground font-mono">
                                {payment.reference || '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Rent schedule */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Rent Schedule
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-6">
                  <div className="min-w-[600px] px-6">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Period</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Paid</TableHead>
                          <TableHead className="text-right">Outstanding</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {schedule?.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium text-sm">
                              {format(new Date(item.due_date), 'dd MMM yyyy')}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {format(new Date(item.period_start), 'dd MMM')} – {format(new Date(item.period_end), 'dd MMM')}
                            </TableCell>
                            <TableCell className="text-right text-sm">{formatGBP(item.rent_amount)}</TableCell>
                            <TableCell className="text-right text-sm">{formatGBP(item.amount_paid || 0)}</TableCell>
                            <TableCell className="text-right text-sm">{formatGBP(item.amount_outstanding || 0)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-xs ${statusColors[item.status] || ''}`}>
                                {item.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </TenantPortalLayoutV2>
  );
}
