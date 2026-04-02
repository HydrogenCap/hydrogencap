import { AlertTriangle, Calendar, TrendingUp, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { AnimatedNumber } from '@/components/common/AnimatedNumber';
import type { MonthSummaryData } from '@/hooks/useRentCollection';

interface RentSummaryCardsProps {
  data: MonthSummaryData;
}

export function RentSummaryCards({ data }: RentSummaryCardsProps) {
  const cards = [
    {
      label: 'Overdue',
      rawValue: data.totalOverdue,
      subtitle: 'Total outstanding',
      bg: 'bg-[hsl(348,70%,36%)]',
      icon: AlertTriangle,
    },
    {
      label: 'Due Today',
      rawValue: data.dueToday,
      subtitle: 'Awaiting payment',
      bg: 'bg-[hsl(43,70%,38%)]',
      icon: Calendar,
    },
    {
      label: 'This Month',
      rawValue: null,
      displayValue: (
        <>
          <AnimatedNumber value={data.thisMonthCollected} prefix="£" /> / <AnimatedNumber value={data.thisMonthExpected} prefix="£" />
        </>
      ),
      subtitle: 'Collected vs expected',
      bg: 'bg-[hsl(200,20%,45%)]',
      icon: TrendingUp,
    },
    {
      label: 'Next Month',
      rawValue: data.nextMonthExpected,
      subtitle: 'Expected income',
      bg: 'bg-[hsl(175,45%,30%)]',
      icon: ArrowRight,
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label} className={`${card.bg} border-0 text-white shadow-md transition-shadow duration-150 hover:shadow-lg motion-reduce:transition-none`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-white/80">{card.label}</span>
                <Icon className="h-5 w-5 text-white/60" />
              </div>
              <p className="text-2xl font-bold tracking-tight">
                {card.rawValue !== null && card.rawValue !== undefined ? (
                  <AnimatedNumber value={card.rawValue} prefix="£" />
                ) : (
                  'displayValue' in card ? card.displayValue : '—'
                )}
              </p>
              <p className="text-xs text-white/60 mt-1">{card.subtitle}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
