import { PoundSterling, TrendingUp, TrendingDown, Minus, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useRentKPIs } from '@/hooks/useRentManagement';

const formatGBP = (v: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);

function TrendArrow({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'down') return <TrendingDown className="h-4 w-4 text-green-500" />;
  if (trend === 'up') return <TrendingUp className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

export function RentDashboardStrip() {
  const { data: kpis, isLoading } = useRentKPIs();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-32 mb-1" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!kpis) return null;

  const cards = [
    {
      label: 'Total Monthly Rent Due',
      value: formatGBP(kpis.totalMonthlyDue),
      subtitle: 'This month',
      icon: PoundSterling,
      bg: 'bg-[hsl(200,20%,45%)]',
    },
    {
      label: 'Collected This Month',
      value: formatGBP(kpis.collectedThisMonth),
      subtitle: `${kpis.collectedPercent}% of due`,
      icon: CheckCircle2,
      bg: 'bg-[hsl(142,50%,36%)]',
    },
    {
      label: 'Outstanding This Month',
      value: formatGBP(kpis.outstandingThisMonth),
      subtitle: 'Awaiting payment',
      icon: Clock,
      bg: 'bg-[hsl(43,70%,38%)]',
    },
    {
      label: 'Avg Days to Payment',
      value: `${kpis.avgDaysToPayment} days`,
      subtitle: kpis.avgDaysToPaymentTrend === 'down'
        ? 'Improving'
        : kpis.avgDaysToPaymentTrend === 'up'
        ? 'Getting slower'
        : 'Stable',
      icon: Clock,
      bg: 'bg-[hsl(175,45%,30%)]',
      trend: kpis.avgDaysToPaymentTrend,
    },
    {
      label: 'Arrears Balance',
      value: formatGBP(kpis.arrearsBalance),
      subtitle: 'Total overdue',
      icon: AlertTriangle,
      bg: 'bg-[hsl(348,70%,36%)]',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label} className={`${card.bg} border-0 text-white shadow-md`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-white/80 leading-tight">{card.label}</span>
                <Icon className="h-4 w-4 text-white/60 shrink-0" />
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xl font-bold tracking-tight">{card.value}</p>
                {'trend' in card && card.trend && <TrendArrow trend={card.trend} />}
              </div>
              <p className="text-xs text-white/60 mt-1">{card.subtitle}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
