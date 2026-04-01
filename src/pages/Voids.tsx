import { useState, useMemo, useEffect } from 'react';
import { format, differenceInDays } from 'date-fns';
import { DoorOpen, AlertTriangle, TrendingDown, Clock, PoundSterling, Percent, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  useActiveVoids,
  useVoidPeriods,
  useVoidStats,
  useVoidRate,
  useUntrackedVoids,
  useEndVoidPeriod,
  useCreateVoidPeriod,
  VOID_REASON_LABELS,
  type ActiveVoid,
  type VoidReason,
} from '@/hooks/useVoidPeriods';
import { Checkbox } from '@/components/ui/checkbox';
import { formatGBP } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

function KpiCard({ label, value, subtitle, icon: Icon, className }: {
  label: string; value: string; subtitle?: string; icon: React.ComponentType<{ className?: string }>; className?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={cn('text-xl md:text-2xl font-bold', className)}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <Icon className={cn('h-5 w-5 text-muted-foreground', className)} />
        </div>
      </CardContent>
    </Card>
  );
}

function VoidTrendChart({ voids }: { voids: ActiveVoid[] }) {
  const chartData = useMemo(() => {
    const months: { month: string; voidRate: number }[] = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = format(d, 'MMM yy');
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

      const activeInMonth = voids.filter(v => {
        const start = new Date(v.start_date);
        const end = v.end_date ? new Date(v.end_date) : new Date();
        return start <= monthEnd && end >= d;
      }).length;

      months.push({ month: monthStr, voidRate: activeInMonth });
    }

    return months;
  }, [voids]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingDown className="h-4 w-4" />
          Void Trend (12 months)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="month" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                borderColor: 'hsl(var(--border))',
                color: 'hsl(var(--foreground))',
              }}
            />
            <Area
              type="monotone"
              dataKey="voidRate"
              name="Active Voids"
              stroke="hsl(var(--destructive))"
              fill="hsl(var(--destructive) / 0.15)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

const CHECKLIST_ITEMS = [
  'Clean & deep clean',
  'Repaint / touch-up',
  'Inventory check',
  'Advertise room',
  'Reference applicants',
];

function VoidChecklist({ voidId }: { voidId: string }) {
  const storageKey = `void-checklist-${voidId}`;
  const [checked, setChecked] = useState<boolean[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : CHECKLIST_ITEMS.map(() => false);
    } catch (err) {
      console.error('Failed to load void checklist from storage:', err);
      return CHECKLIST_ITEMS.map(() => false);
    }
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(checked));
  }, [checked, storageKey]);

  const toggle = (i: number) =>
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

  const done = checked.filter(Boolean).length;

  return (
    <div className="mt-2 space-y-1">
      <p className="text-xs text-muted-foreground font-medium mb-1">
        Turnover checklist ({done}/{CHECKLIST_ITEMS.length})
      </p>
      {CHECKLIST_ITEMS.map((item, i) => (
        <label key={i} className="flex items-center gap-2 text-xs cursor-pointer select-none">
          <Checkbox checked={checked[i]} onCheckedChange={() => toggle(i)} className="h-3.5 w-3.5" />
          <span className={checked[i] ? 'line-through text-muted-foreground' : ''}>{item}</span>
        </label>
      ))}
    </div>
  );
}

export default function Voids() {
  const { data: activeVoids, isLoading: loadingActive } = useActiveVoids();
  const { data: allVoids } = useVoidPeriods();
  const stats = useVoidStats();
  const { data: rateData } = useVoidRate();
  const { data: untrackedVoids } = useUntrackedVoids();
  const endVoid = useEndVoidPeriod();
  const createVoid = useCreateVoidPeriod();
  const [historyOpen, setHistoryOpen] = useState(false);

  const completedVoids = useMemo(
    () => (allVoids || []).filter(v => v.end_date).sort((a, b) => b.end_date!.localeCompare(a.end_date!)),
    [allVoids],
  );

  const handleEndVoid = (id: string) => {
    endVoid.mutate({ id, endDate: format(new Date(), 'yyyy-MM-dd') });
  };

  const handleRecordVoid = (roomId: string, propertyId: string) => {
    createVoid.mutate({
      propertyId,
      roomId,
      startDate: format(new Date(), 'yyyy-MM-dd'),
      reason: 'between_tenants',
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Void Management</h1>
            <p className="text-muted-foreground">Track empty rooms and their financial impact</p>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Active Voids"
            value={String(stats?.activeCount ?? 0)}
            icon={DoorOpen}
            className={stats?.activeCount ? 'text-destructive' : ''}
          />
          <KpiCard
            label="Portfolio Void Rate"
            value={`${rateData?.voidRate ?? 0}%`}
            subtitle={rateData ? `${rateData.voidRooms} of ${rateData.totalRooms} rooms` : undefined}
            icon={Percent}
            className={rateData && rateData.voidRate > 5 ? 'text-destructive' : ''}
          />
          <KpiCard
            label="Monthly Void Cost"
            value={formatGBP(stats?.totalMonthlyCost ?? 0)}
            subtitle="Lost rent from active voids"
            icon={PoundSterling}
            className={stats?.totalMonthlyCost ? 'text-warning' : ''}
          />
          <KpiCard
            label="Avg Void Duration"
            value={`${stats?.averageDays ?? 0} days`}
            subtitle="Completed voids"
            icon={Clock}
          />
        </div>

        {/* Untracked Voids Alert */}
        {untrackedVoids && untrackedVoids.length > 0 && (
          <Alert variant="destructive" className="border-warning bg-warning/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-warning">{untrackedVoids.length} rooms may be void</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="text-sm mb-3">These rooms have no active tenancy and no void period recorded.</p>
              <div className="space-y-2">
                {untrackedVoids.map(uv => (
                  <div key={uv.roomId} className="flex items-center justify-between bg-background/50 rounded-md px-3 py-2">
                    <div>
                      <span className="font-medium">{uv.roomName}</span>
                      <span className="text-muted-foreground text-sm ml-2">{uv.propertyAddress}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRecordVoid(uv.roomId, uv.propertyId)}
                      disabled={createVoid.isPending}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Record Void
                    </Button>
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Active Voids Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Voids</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingActive ? (
              <p className="text-muted-foreground text-sm py-4 text-center">Loading...</p>
            ) : !activeVoids || activeVoids.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">No active void periods — all rooms occupied 🎉</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Void Since</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Lost Rent</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Actions</TableHead>
                    <TableHead>Checklist</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeVoids.map(v => {
                    const days = differenceInDays(new Date(), new Date(v.start_date));
                    const dailyRent = v.room?.current_rent_pcm
                      ? v.room.current_rent_pcm / 30
                      : (v.estimated_monthly_cost || 0) / 30;
                    const lostRent = Math.round(dailyRent * days);

                    return (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.room?.room_name ?? '—'}</TableCell>
                        <TableCell>{v.property?.address_line_1}, {v.property?.postcode}</TableCell>
                        <TableCell>{format(new Date(v.start_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell>
                          <Badge variant={days > 30 ? 'destructive' : days > 14 ? 'secondary' : 'outline'}>
                            {days}d
                          </Badge>
                        </TableCell>
                        <TableCell className="text-destructive font-medium">{formatGBP(lostRent)}</TableCell>
                        <TableCell>{v.reason ? VOID_REASON_LABELS[v.reason] : '—'}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEndVoid(v.id)}
                            disabled={endVoid.isPending}
                          >
                            End Void
                          </Button>
                        </TableCell>
                        <TableCell>
                          <VoidChecklist voidId={v.id} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Void Trend Chart */}
        {allVoids && allVoids.length > 0 && <VoidTrendChart voids={allVoids as any} />}

        {/* Void History */}
        {completedVoids.length > 0 && (
          <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="text-base flex items-center gap-2">
                    {historyOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Void History ({completedVoids.length})
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Property</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>End</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {completedVoids.slice(0, 20).map(v => {
                        const days = differenceInDays(new Date(v.end_date!), new Date(v.start_date));
                        return (
                          <TableRow key={v.id}>
                            <TableCell>{v.property_id.slice(0, 8)}…</TableCell>
                            <TableCell>{format(new Date(v.start_date), 'dd MMM yy')}</TableCell>
                            <TableCell>{format(new Date(v.end_date!), 'dd MMM yy')}</TableCell>
                            <TableCell>{days} days</TableCell>
                            <TableCell>{v.reason ? VOID_REASON_LABELS[v.reason as VoidReason] : '—'}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}
      </div>
    </AppLayout>
  );
}
