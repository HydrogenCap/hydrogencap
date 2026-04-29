import { Card, CardContent } from '@/components/ui/card';
import { fmtGBP, fmtGBPCompact } from '@/hooks/useLoanFacilities';

export function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

interface Props {
  totalDebt: number;
  weightedRate: number;
  totalMonthly: number;
  fixedBalance: number;
  variableBalance: number;
  fixedPct: string;
  variablePct: string;
}

export function StatsBar({
  totalDebt, weightedRate, totalMonthly,
  fixedBalance, variableBalance, fixedPct, variablePct,
}: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <StatCard title="Total Debt" value={fmtGBPCompact(totalDebt)} />
      <StatCard title="Weighted Avg Rate" value={`${weightedRate.toFixed(2)}%`} />
      <StatCard title="Monthly Debt Service" value={`${fmtGBP(totalMonthly)} /mo`} />
      <Card><CardContent className="pt-4">
        <p className="text-xs text-muted-foreground mb-1">Fixed vs Variable</p>
        <div className="flex h-3 rounded overflow-hidden mb-1">
          {totalDebt > 0 && <>
            <div className="bg-blue-500" style={{ width: `${fixedPct}%` }} />
            <div className="bg-orange-400" style={{ width: `${variablePct}%` }} />
          </>}
        </div>
        <p className="text-xs text-muted-foreground">{fmtGBPCompact(fixedBalance)} Fixed ({fixedPct}%) | {fmtGBPCompact(variableBalance)} Variable ({variablePct}%)</p>
      </CardContent></Card>
    </div>
  );
}
