import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { PoundSterling, ArrowRight, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { useRentSchedule } from '@/hooks/useRentCollection';
import { formatGBP } from '@/lib/calculations';

export function RentCollectionWidget() {
  const currentMonth = format(new Date(), 'yyyy-MM');
  const { data: scheduleData } = useRentSchedule({ month: currentMonth });
  const schedule = scheduleData?.items;

  const stats = useMemo(() => {
    if (!schedule) return { totalDue: 0, collected: 0, outstanding: 0, overdue: 0, rate: 0, paidCount: 0, totalCount: 0 };

    const totalDue = schedule.reduce((s, r) => s + (r.rent_amount || 0), 0);
    const collected = schedule.reduce((s, r) => s + (r.amount_paid || 0), 0);
    const outstanding = schedule.reduce((s, r) => s + (r.amount_outstanding || 0), 0);
    const overdue = schedule.filter(r => r.status === 'overdue').length;
    const paidCount = schedule.filter(r => r.status === 'paid').length;

    return {
      totalDue,
      collected,
      outstanding,
      overdue,
      rate: totalDue > 0 ? (collected / totalDue) * 100 : 0,
      paidCount,
      totalCount: schedule.length,
    };
  }, [schedule]);

  const monthLabel = format(new Date(), 'MMMM');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <PoundSterling className="h-4 w-4" />
          {monthLabel} Rent
          {stats.rate === 100 && stats.totalCount > 0 && (
            <Badge variant="outline" className="ml-auto border-primary/30 bg-primary/5 text-primary text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" /> All collected
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Collected</span>
            <span className="font-medium">{formatGBP(stats.collected)} of {formatGBP(stats.totalDue)}</span>
          </div>
          <Progress value={stats.rate} className="h-3" />
          <p className="text-xs text-muted-foreground mt-1">{Math.round(stats.rate)}% collected · {stats.paidCount}/{stats.totalCount} tenancies paid</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className={`text-lg font-bold ${stats.outstanding > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
              {stats.outstanding > 0 ? formatGBP(stats.outstanding) : '£0'}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p className={`text-lg font-bold ${stats.overdue > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {stats.overdue > 0 ? `${stats.overdue} tenancies` : 'None'}
            </p>
          </div>
        </div>

        <Link to="/rent" className="flex items-center gap-1 text-sm text-primary hover:underline">
          View rent ledger
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
