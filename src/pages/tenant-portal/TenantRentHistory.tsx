import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { PoundSterling } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TenantPortalLayout } from '@/components/tenant-portal/TenantPortalLayout';
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

export default function TenantRentHistory() {
  const { tenancyId } = useTenantPortalSession();

  const { data: schedule, isLoading } = useQuery({
    queryKey: ['tenant-portal-rent-history', tenancyId],
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
    enabled: !!tenancyId,
  });

  const { data: payments } = useQuery({
    queryKey: ['tenant-portal-payments', tenancyId],
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
    enabled: !!tenancyId,
  });

  return (
    <TenantPortalLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <PoundSterling className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Rent History</h1>
        </div>

        {isLoading ? (
          <LoadingState text="Loading rent history..." />
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid gap-4 md:grid-cols-4">
              {(() => {
                const totalDue = schedule?.reduce((s, r) => s + r.rent_amount, 0) || 0;
                const totalPaid = schedule?.reduce((s, r) => s + (r.amount_paid || 0), 0) || 0;
                const totalOutstanding = schedule?.reduce((s, r) => s + (r.amount_outstanding || 0), 0) || 0;
                const paidCount = schedule?.filter(r => r.status === 'paid').length || 0;

                return (
                  <>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground">Total Charged</p>
                        <p className="text-xl font-bold">{formatGBP(totalDue)}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground">Total Paid</p>
                        <p className="text-xl font-bold text-primary">{formatGBP(totalPaid)}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground">Outstanding</p>
                        <p className={`text-xl font-bold ${totalOutstanding > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {formatGBP(totalOutstanding)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground">Periods Paid</p>
                        <p className="text-xl font-bold">{paidCount} / {schedule?.length || 0}</p>
                      </CardContent>
                    </Card>
                  </>
                );
              })()}
            </div>

            {/* Schedule table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rent Schedule</CardTitle>
              </CardHeader>
              <CardContent>
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
                        <TableCell className="font-medium">
                          {format(new Date(item.due_date), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(item.period_start), 'dd MMM')} – {format(new Date(item.period_end), 'dd MMM')}
                        </TableCell>
                        <TableCell className="text-right">{formatGBP(item.rent_amount)}</TableCell>
                        <TableCell className="text-right">{formatGBP(item.amount_paid || 0)}</TableCell>
                        <TableCell className="text-right">{formatGBP(item.amount_outstanding || 0)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColors[item.status] || ''}>
                            {item.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </TenantPortalLayout>
  );
}
