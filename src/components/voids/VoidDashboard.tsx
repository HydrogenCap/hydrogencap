import { useState, useMemo } from 'react';
import { format, differenceInDays } from 'date-fns';
import {
  DoorOpen,
  Percent,
  Clock,
  PoundSterling,
  TrendingDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  useActiveVoids,
  useVoidHistory,
  useEndVoid,
  useVoidStats,
  VOID_REASON_LABELS,
  type ActiveVoid,
  type VoidPeriod,
} from '@/hooks/useVoidTracking';
import { calculateVoidDays } from '@/lib/void-calculator';
import { formatGBP } from '@/lib/calculations';
import { cn } from '@/lib/utils';

function KpiCard({
  label,
  value,
  subtitle,
  icon: Icon,
  className,
}: {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={cn('text-xl md:text-2xl font-bold', className)}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <Icon className={cn('h-5 w-5 text-muted-foreground', className)} />
        </div>
      </CardContent>
    </Card>
  );
}

function VoidMonthlyChart({ activeVoids, history }: { activeVoids: ActiveVoid[]; history: VoidPeriod[] }) {
  const chartData = useMemo(() => {
    const allVoids = [...activeVoids, ...history];
    const months: { month: string; voidDays: number }[] = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
      const monthStr = format(monthStart, 'MMM yy');

      let totalDays = 0;
      for (const v of allVoids) {
        const vStart = new Date(v.start_date);
        const vEnd = v.end_date ? new Date(v.end_date) : new Date();

        if (vStart > monthEnd || vEnd < monthStart) continue;

        const overlapStart = vStart > monthStart ? vStart : monthStart;
        const overlapEnd = vEnd < monthEnd ? vEnd : monthEnd;
        const days = Math.ceil(
          (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24),
        ) + 1;
        totalDays += Math.max(0, days);
      }

      months.push({ month: monthStr, voidDays: totalDays });
    }

    return months;
  }, [activeVoids, history]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingDown className="h-4 w-4" />
          Void Days Per Month (12 months)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="month"
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                borderColor: 'hsl(var(--border))',
                color: 'hsl(var(--foreground))',
              }}
              formatter={(value: number) => [`${value} days`, 'Void Days']}
            />
            <Bar
              dataKey="voidDays"
              name="Void Days"
              fill="hsl(var(--destructive))"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function EndVoidDialog({
  voidPeriod,
  open,
  onOpenChange,
}: {
  voidPeriod: ActiveVoid | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const endVoid = useEndVoid();
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [actualCosts, setActualCosts] = useState('');

  const handleSubmit = () => {
    if (!voidPeriod) return;
    endVoid.mutate(
      {
        id: voidPeriod.id,
        endDate,
        actualCosts: actualCosts ? parseFloat(actualCosts) : undefined,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>End Void Period</DialogTitle>
          <DialogDescription>
            {voidPeriod?.room?.room_name
              ? `${voidPeriod.room.room_name} at ${voidPeriod.property.address_line_1}`
              : voidPeriod?.property.address_line_1}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="end-date">End Date</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="actual-costs">
              Actual Costs During Void (optional)
            </Label>
            <Input
              id="actual-costs"
              type="number"
              placeholder="0.00"
              value={actualCosts}
              onChange={e => setActualCosts(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Total costs incurred during the void period (repairs, utilities, etc.)
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={endVoid.isPending}>
            {endVoid.isPending ? 'Ending...' : 'End Void'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function VoidDashboard() {
  const { data: activeVoids, isLoading: loadingActive } = useActiveVoids();
  const { data: history } = useVoidHistory();
  const { data: stats } = useVoidStats();
  const [endingVoid, setEndingVoid] = useState<ActiveVoid | null>(null);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Current Voids"
          value={String(stats?.activeCount ?? 0)}
          icon={DoorOpen}
          className={stats?.activeCount ? 'text-destructive' : ''}
        />
        <KpiCard
          label="Portfolio Void Rate"
          value={`${stats?.voidRate ?? 0}%`}
          subtitle={
            stats
              ? `${stats.voidRooms} of ${stats.totalRooms} rooms`
              : undefined
          }
          icon={Percent}
          className={
            stats && stats.voidRate > 5 ? 'text-destructive' : ''
          }
        />
        <KpiCard
          label="Avg Void Duration"
          value={`${stats?.avgDuration ?? 0} days`}
          subtitle="Completed voids"
          icon={Clock}
        />
        <KpiCard
          label="Total Void Cost YTD"
          value={formatGBP(stats?.ytdCost ?? 0)}
          subtitle="Lost rent year-to-date"
          icon={PoundSterling}
          className={stats?.ytdCost ? 'text-warning' : ''}
        />
      </div>

      {/* Active Voids Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Voids</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingActive ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              Loading...
            </p>
          ) : !activeVoids || activeVoids.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              No active void periods
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Days Void</TableHead>
                  <TableHead>Est. Cost</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeVoids.map(v => {
                  const days = calculateVoidDays(v.start_date);
                  const dailyRent =
                    v.room?.current_rent_pcm
                      ? v.room.current_rent_pcm / 30
                      : (v.estimated_monthly_cost || 0) / 30;
                  const estCost = Math.round(dailyRent * days);

                  return (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">
                        {v.property.address_line_1}, {v.property.postcode}
                      </TableCell>
                      <TableCell>{v.room?.room_name ?? '—'}</TableCell>
                      <TableCell>
                        {format(new Date(v.start_date), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            days > 30
                              ? 'destructive'
                              : days > 14
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {days}d
                        </Badge>
                      </TableCell>
                      <TableCell className="text-destructive font-medium">
                        {formatGBP(estCost)}
                      </TableCell>
                      <TableCell>
                        {v.reason
                          ? VOID_REASON_LABELS[v.reason]
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEndingVoid(v)}
                        >
                          End Void
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Historical Void Chart */}
      {activeVoids && history && (activeVoids.length > 0 || history.length > 0) && (
        <VoidMonthlyChart activeVoids={activeVoids} history={history} />
      )}

      {/* End Void Dialog */}
      <EndVoidDialog
        voidPeriod={endingVoid}
        open={!!endingVoid}
        onOpenChange={open => {
          if (!open) setEndingVoid(null);
        }}
      />
    </div>
  );
}
