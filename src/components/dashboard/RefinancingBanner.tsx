import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, ArrowRight } from 'lucide-react';
import { supabaseAny } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { differenceInDays, format } from 'date-fns';

interface ExpiringLoan {
  id: string;
  product_name: string | null;
  rate_expiry_date: string;
  current_balance: number | null;
  interest_rate: number | null;
  property_id: string | null;
}

/**
 * Surfaces loans whose fixed-rate period ends within `windowDays`.
 * Used on the dashboard as a single nudge — clicking takes the user
 * into the full refinancing-opportunities surface.
 */
export function RefinancingBanner({ windowDays = 180 }: { windowDays?: number }) {
  const { data: loans } = useQuery({
    queryKey: ['refinancing-banner-loans', windowDays],
    queryFn: async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + windowDays);
      const { data, error } = await supabaseAny
        .from('loan_facilities')
        .select('id, product_name, rate_expiry_date, current_balance, interest_rate, property_id')
        .not('rate_expiry_date', 'is', null)
        .lte('rate_expiry_date', cutoff.toISOString().split('T')[0])
        .gte('rate_expiry_date', new Date().toISOString().split('T')[0])
        .eq('status', 'active');
      if (error) throw error;
      return (data || []) as ExpiringLoan[];
    },
    staleTime: 5 * 60_000,
  });

  const summary = useMemo(() => {
    if (!loans || loans.length === 0) return null;
    const next = [...loans].sort((a, b) =>
      a.rate_expiry_date.localeCompare(b.rate_expiry_date)
    )[0];
    const daysUntil = differenceInDays(new Date(next.rate_expiry_date), new Date());
    const totalBalance = loans.reduce((s, l) => s + (Number(l.current_balance) || 0), 0);
    return { next, daysUntil, count: loans.length, totalBalance };
  }, [loans]);

  if (!summary) return null;

  return (
    <Card className="border-amber-500/40 bg-amber-500/5 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-amber-500/15 p-2">
            <TrendingUp className="h-5 w-5 text-amber-600" aria-hidden />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Refinancing window opening
              </h3>
              <Badge variant="outline" className="border-amber-500/40 text-amber-700">
                {summary.count} loan{summary.count === 1 ? '' : 's'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Next rate expiry in <strong>{summary.daysUntil} day{summary.daysUntil === 1 ? '' : 's'}</strong>
              {' '}({format(new Date(summary.next.rate_expiry_date), 'd MMM yyyy')})
              {summary.totalBalance > 0 && (
                <> · £{Math.round(summary.totalBalance).toLocaleString('en-GB')} balance at risk</>
              )}
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline" className="self-start sm:self-auto">
          <Link to="/refinancing-opportunities" className="gap-1">
            Review options <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
