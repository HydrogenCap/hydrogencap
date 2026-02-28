import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DoorOpen, ArrowRight } from 'lucide-react';
import { useVoidStats, useVoidRate } from '@/hooks/useVoidPeriods';
import { formatGBP } from '@/lib/calculations';
import { cn } from '@/lib/utils';

export function VoidCostWidget() {
  const stats = useVoidStats();
  const { data: rateData } = useVoidRate();

  const isHighVoidRate = rateData && rateData.voidRate > 5;
  const hasActiveVoids = stats && stats.activeCount > 0;

  return (
    <Card className={cn(isHighVoidRate && 'border-destructive/50')}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <DoorOpen className={cn('h-4 w-4', hasActiveVoids ? 'text-warning' : 'text-muted-foreground')} />
          Voids
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-muted-foreground">Active voids</span>
          <span className={cn('text-lg font-bold', hasActiveVoids && 'text-destructive')}>
            {stats?.activeCount ?? 0}
          </span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-muted-foreground">Monthly cost</span>
          <span className="text-sm font-medium">{formatGBP(stats?.totalMonthlyCost ?? 0)}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-muted-foreground">Void rate</span>
          <span className={cn('text-sm font-medium', isHighVoidRate && 'text-destructive')}>
            {rateData?.voidRate ?? 0}%
          </span>
        </div>
        <Link to="/voids" className="flex items-center gap-1 text-sm text-primary hover:underline pt-1">
          View voids <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
