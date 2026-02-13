import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3, TrendingUp, TrendingDown, AlertTriangle,
  Clock, User, Home, ChevronRight, Star,
} from 'lucide-react';
import { format, differenceInMonths } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePortfolioValuationSummaries } from '@/hooks/useDocumentSummary';
import { useProperties } from '@/hooks/useProperties';
import { cn } from '@/lib/utils';

const fmt = (n: number) =>
  n >= 1_000_000 ? `£${(n / 1_000_000).toFixed(2)}M` : `£${Math.round(n).toLocaleString()}`;

const COND: Record<string, string> = {
  Good: 'text-emerald-600', Fair: 'text-amber-600', Poor: 'text-red-600', 'Very Poor': 'text-red-700',
};

export function ValuationMasterDashboard() {
  const { data: summaries, isLoading } = usePortfolioValuationSummaries();
  const { data: allProperties } = useProperties();

  const latestByProp = useMemo(() => {
    if (!summaries) return new Map();
    const map = new Map<string, (typeof summaries)[0]>();
    for (const s of summaries) {
      if (s.property_id && !map.has(s.property_id)) map.set(s.property_id, s);
    }
    return map;
  }, [summaries]);

  const stats = useMemo(() => {
    const entries = [...latestByProp.values()];
    const withVal = entries.filter(e => e.valuation_figure_gbp);
    const totalSurveyor = withVal.reduce((s, e) => s + (e.valuation_figure_gbp || 0), 0);
    const totalRecorded = withVal.reduce((s, e) => s + (e.property?.current_value_gbp || 0), 0);
    const variance = totalRecorded > 0 ? ((totalSurveyor - totalRecorded) / totalRecorded) * 100 : 0;
    const now = new Date();
    const stale = entries.filter(e => !e.valuation_date || differenceInMonths(now, new Date(e.valuation_date)) > 12);
    const valued = new Set(entries.map(e => e.property_id).filter(Boolean));
    const missing = (allProperties?.length || 0) - valued.size;
    const cond: Record<string, number> = {};
    entries.forEach(e => { if (e.condition_rating) cond[e.condition_rating] = (cond[e.condition_rating] || 0) + 1; });
    return {
      count: withVal.length, totalSurveyor, totalRecorded, variance,
      stale: stale.length, missing, cond, total: allProperties?.length || 0,
    };
  }, [latestByProp, allProperties]);

  if (isLoading || !summaries || summaries.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center">
          <BarChart3 className="h-5 w-5 mx-auto mb-1.5 text-blue-500" />
          <div className="text-xl font-bold">{fmt(stats.totalSurveyor)}</div>
          <div className="text-xs text-muted-foreground">Surveyor Valued Total</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{stats.count} properties</div>
        </CardContent></Card>

        <Card><CardContent className="p-4 text-center">
          {stats.variance >= 0
            ? <TrendingUp className="h-5 w-5 mx-auto mb-1.5 text-emerald-500" />
            : <TrendingDown className="h-5 w-5 mx-auto mb-1.5 text-red-500" />}
          <div className={cn('text-xl font-bold', stats.variance >= 0 ? 'text-emerald-600' : 'text-red-600')}>
            {stats.variance >= 0 ? '+' : ''}{stats.variance.toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground">vs Recorded Values</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Recorded: {fmt(stats.totalRecorded)}</div>
        </CardContent></Card>

        <Card><CardContent className="p-4 text-center">
          <AlertTriangle className={cn('h-5 w-5 mx-auto mb-1.5', (stats.stale + stats.missing) > 0 ? 'text-amber-500' : 'text-emerald-500')} />
          <div className="text-xl font-bold">{stats.total - stats.stale - stats.missing}/{stats.total}</div>
          <div className="text-xs text-muted-foreground">Up-to-date Valuations</div>
          {(stats.stale > 0 || stats.missing > 0) && (
            <div className="text-[10px] text-amber-500 mt-0.5">
              {stats.stale > 0 && `${stats.stale} stale`}
              {stats.stale > 0 && stats.missing > 0 && ' · '}
              {stats.missing > 0 && `${stats.missing} missing`}
            </div>
          )}
        </CardContent></Card>

        <Card><CardContent className="p-4 text-center">
          <Star className="h-5 w-5 mx-auto mb-1.5 text-purple-500" />
          <div className="space-y-1">
            {Object.entries(stats.cond).sort(([, a], [, b]) => b - a).map(([c, n]) => (
              <div key={c} className="flex items-center justify-center gap-1.5 text-xs">
                <span className={COND[c] || 'text-muted-foreground'}>{c}</span>
                <span className="text-muted-foreground">({n})</span>
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Condition Breakdown</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Home className="h-4 w-4" />Property Valuations
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {[...latestByProp.entries()].map(([pid, val]) => {
              const prop = val.property;
              if (!prop) return null;
              const recorded = prop.current_value_gbp || 0;
              const surveyed = val.valuation_figure_gbp || 0;
              const diff = recorded > 0 && surveyed > 0 ? ((surveyed - recorded) / recorded) * 100 : null;
              const isStale = val.valuation_date && differenceInMonths(new Date(), new Date(val.valuation_date)) > 12;
              return (
                <Link key={pid} to={`/properties/${pid}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{prop.address_line}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      {prop.postcode && <span>{prop.postcode}</span>}
                      {val.surveyor_firm && <span className="flex items-center gap-0.5"><User className="h-3 w-3" />{val.surveyor_firm}</span>}
                      {val.valuation_date && <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{format(new Date(val.valuation_date), 'MMM yyyy')}</span>}
                      {val.condition_rating && <span className={COND[val.condition_rating]}>{val.condition_rating}</span>}
                      {isStale && <Badge variant="outline" className="text-amber-500 border-amber-300 text-[10px] h-4">Stale</Badge>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {surveyed > 0 && <p className="text-sm font-bold">{fmt(surveyed)}</p>}
                    {diff !== null && (
                      <p className={cn('text-xs', diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-muted-foreground')}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(1)}% vs recorded
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
