import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { RoomPnLPeriod } from '@/hooks/useRoomPnL';
import { fmtRent } from '../utils/format';
import type { RoomDetailState } from '../hooks/useRoomDetailState';

export function RoomPnLCard({ state }: { state: RoomDetailState }) {
  const { pnlPeriod, setPnlPeriod, roomPnL, pnlLoading } = state;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Room P&amp;L</CardTitle>
        <Select value={pnlPeriod} onValueChange={(v) => setPnlPeriod(v as RoomPnLPeriod)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="current_month">Current month</SelectItem>
            <SelectItem value="ytd">Year to date</SelectItem>
            <SelectItem value="last_12_months">Last 12 months</SelectItem>
            <SelectItem value="all_time">All time</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-4">
        {pnlLoading || !roomPnL ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            <div className="text-center py-4 rounded-lg border bg-muted/30">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Contribution</p>
              <p className={`text-4xl font-bold ${roomPnL.contribution >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                {roomPnL.contribution >= 0 ? '' : '-'}{fmtRent(Math.abs(roomPnL.contribution))}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="p-3 rounded-md border">
                <p className="text-xs text-muted-foreground">Gross income</p>
                <p className="font-semibold text-foreground">{fmtRent(roomPnL.grossIncome)}</p>
              </div>
              <div className="p-3 rounded-md border">
                <p className="text-xs text-muted-foreground">Void days</p>
                <p className="font-semibold text-foreground">{roomPnL.voidDays}</p>
                <p className="text-xs text-destructive">-{fmtRent(roomPnL.voidLoss)}</p>
              </div>
              <div className="p-3 rounded-md border">
                <p className="text-xs text-muted-foreground">Maintenance</p>
                <p className="font-semibold text-destructive">-{fmtRent(roomPnL.maintenanceCosts)}</p>
              </div>
              <div className="p-3 rounded-md border">
                <p className="text-xs text-muted-foreground">Occupancy</p>
                <p className="font-semibold text-foreground">{Math.round(roomPnL.occupancyRate * 100)}%</p>
              </div>
            </div>
            {roomPnL.limitations.length > 0 && (
              <p className="text-xs text-muted-foreground italic">{roomPnL.limitations.join(' ')}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
