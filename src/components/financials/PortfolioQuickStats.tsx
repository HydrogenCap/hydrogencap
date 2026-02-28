import { Card, CardContent } from '@/components/ui/card';
import { formatGBPDecimal, formatPercent } from '@/lib/calculations';
import type { PortfolioFinancials } from '@/hooks/usePortfolioFinancials';

interface Props {
  data: PortfolioFinancials;
}

export function PortfolioQuickStats({ data }: Props) {
  const positiveCount = data.properties.filter(p => p.status === 'positive').length;
  const totalCount = data.properties.length;
  const avgNetYield = totalCount > 0
    ? data.properties.reduce((s, p) => s + p.netYield, 0) / totalCount
    : 0;

  return (
    <Card>
      <CardContent className="py-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatItem label="Positive cashflow" value={`${positiveCount} of ${totalCount}`} />
          <StatItem label="Average net yield" value={formatPercent(avgNetYield)} />
          <StatItem label="Annual rent roll" value={formatGBPDecimal(data.monthlyIncome * 12)} />
          <StatItem label="Portfolio LTV" value={formatPercent(data.portfolioLTV)} />
        </div>
      </CardContent>
    </Card>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}
