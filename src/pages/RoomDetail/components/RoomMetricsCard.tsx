import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fmtRent } from '../utils/format';
import type { RoomDetailState } from '../hooks/useRoomDetailState';

export function RoomMetricsCard({ state }: { state: RoomDetailState }) {
  const { annualRent, maintenanceCostTotal, maintenanceCosts } = state;
  const netProfit = annualRent - maintenanceCostTotal;
  const profitMargin = annualRent > 0 ? Math.max(0, Math.min(100, (netProfit / annualRent) * 100)) : 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Profitability
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-1 p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg">
            <p className="text-xs text-muted-foreground">Annual Rent</p>
            <p className="text-xl font-bold text-emerald-600">{fmtRent(annualRent)}</p>
          </div>
          <div className="space-y-1 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
            <p className="text-xs text-muted-foreground">Maintenance Costs</p>
            <p className="text-xl font-bold text-destructive">-{fmtRent(maintenanceCostTotal)}</p>
            <p className="text-xs text-muted-foreground">{maintenanceCosts.length} job{maintenanceCosts.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="space-y-1 p-3 rounded-lg" style={{ background: netProfit >= 0 ? 'rgb(240 253 244)' : 'rgb(254 242 242)' }}>
            <p className="text-xs text-muted-foreground">Net Annual Profit</p>
            <p className={`text-xl font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>{fmtRent(netProfit)}</p>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Profit margin after maintenance</span>
            <span>{Math.round(profitMargin)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: profitMargin + '%' }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
