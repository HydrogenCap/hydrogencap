import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { formatGBP } from '@/lib/calculations';
import { ForecastChart } from './ForecastChart';
import { useRunForecast, type FinancialForecast } from '@/hooks/useFinancialForecasts';

interface StressTestPanelProps {
  onForecastGenerated?: (forecast: FinancialForecast) => void;
}

export function StressTestPanel({ onForecastGenerated }: StressTestPanelProps) {
  const [rateChangeBps, setRateChangeBps] = useState(0);
  const [voidRate, setVoidRate] = useState(5);
  const [rentGrowth, setRentGrowth] = useState(2);
  const [maintenancePct, setMaintenancePct] = useState(1);
  const [horizon, setHorizon] = useState<12 | 24 | 60>(24);

  const runForecast = useRunForecast();
  const [result, setResult] = useState<FinancialForecast | null>(null);

  const handleRunStressTest = async () => {
    const forecast = await runForecast.mutateAsync({
      forecast_type: 'stress_test',
      time_horizon_months: horizon,
      assumptions: {
        rent_growth_pct: rentGrowth,
        void_rate_pct: voidRate,
        maintenance_pct: maintenancePct,
        rate_change_bps: rateChangeBps,
      },
    });
    setResult(forecast);
    onForecastGenerated?.(forecast);
  };

  const scenarios = result?.scenarios;
  const baseEnd = scenarios?.base[scenarios.base.length - 1];
  const pessEnd = scenarios?.pessimistic[scenarios.pessimistic.length - 1];
  const optEnd = scenarios?.optimistic[scenarios.optimistic.length - 1];

  return (
    <div className="space-y-6">
      {/* Assumption Sliders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assumptions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Rate Change</label>
                <span className="text-sm text-muted-foreground">
                  {rateChangeBps > 0 ? '+' : ''}{rateChangeBps} bps
                </span>
              </div>
              <Slider
                value={[rateChangeBps]}
                onValueChange={([v]) => setRateChangeBps(v)}
                min={-200}
                max={400}
                step={25}
              />
              <p className="text-xs text-muted-foreground">
                Base rate change applied to variable/expiring mortgages
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Void Rate</label>
                <span className="text-sm text-muted-foreground">{voidRate}%</span>
              </div>
              <Slider
                value={[voidRate]}
                onValueChange={([v]) => setVoidRate(v)}
                min={0}
                max={25}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                Expected percentage of time properties are empty
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Rent Growth</label>
                <span className="text-sm text-muted-foreground">
                  {rentGrowth > 0 ? '+' : ''}{rentGrowth}% p.a.
                </span>
              </div>
              <Slider
                value={[rentGrowth]}
                onValueChange={([v]) => setRentGrowth(v)}
                min={-5}
                max={10}
                step={0.5}
              />
              <p className="text-xs text-muted-foreground">
                Annual rent growth assumption
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Maintenance Increase</label>
                <span className="text-sm text-muted-foreground">
                  +{maintenancePct}% p.a.
                </span>
              </div>
              <Slider
                value={[maintenancePct]}
                onValueChange={([v]) => setMaintenancePct(v)}
                min={0}
                max={10}
                step={0.5}
              />
              <p className="text-xs text-muted-foreground">
                Annual maintenance cost inflation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Horizon:</label>
              {([12, 24, 60] as const).map((h) => (
                <Button
                  key={h}
                  variant={horizon === h ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setHorizon(h)}
                >
                  {h === 12 ? '1yr' : h === 24 ? '2yr' : '5yr'}
                </Button>
              ))}
            </div>
            <div className="flex-1" />
            <Button
              onClick={handleRunStressTest}
              disabled={runForecast.isPending}
            >
              {runForecast.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Run Stress Test
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && scenarios && (
        <>
          {/* Scenario Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Pessimistic */}
            <Card className="border-destructive/30">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  <CardTitle className="text-sm">Pessimistic</CardTitle>
                </div>
                <Badge variant="destructive" className="w-fit text-xs">
                  +200bps / 10% void / -5% rent
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">End Cashflow</span>
                  <span className={pessEnd && pessEnd.net_cashflow >= 0 ? 'text-success' : 'text-destructive'}>
                    {formatGBP(pessEnd?.net_cashflow ?? 0)}/mo
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Cashflow</span>
                  <span className={pessEnd && pessEnd.cumulative_cashflow >= 0 ? 'text-success' : 'text-destructive'}>
                    {formatGBP(pessEnd?.cumulative_cashflow ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">End Equity</span>
                  <span>{formatGBP(pessEnd?.equity ?? 0)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Base */}
            <Card className="border-primary/30">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Minus className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Base Case</CardTitle>
                </div>
                <Badge variant="secondary" className="w-fit text-xs">
                  Your assumptions
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">End Cashflow</span>
                  <span className={baseEnd && baseEnd.net_cashflow >= 0 ? 'text-success' : 'text-destructive'}>
                    {formatGBP(baseEnd?.net_cashflow ?? 0)}/mo
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Cashflow</span>
                  <span className={baseEnd && baseEnd.cumulative_cashflow >= 0 ? 'text-success' : 'text-destructive'}>
                    {formatGBP(baseEnd?.cumulative_cashflow ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">End Equity</span>
                  <span>{formatGBP(baseEnd?.equity ?? 0)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Optimistic */}
            <Card className="border-success/30">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-success" />
                  <CardTitle className="text-sm">Optimistic</CardTitle>
                </div>
                <Badge className="w-fit text-xs bg-success/10 text-success hover:bg-success/20 border-0">
                  -50bps / 2% void / +3% rent
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">End Cashflow</span>
                  <span className={optEnd && optEnd.net_cashflow >= 0 ? 'text-success' : 'text-destructive'}>
                    {formatGBP(optEnd?.net_cashflow ?? 0)}/mo
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Cashflow</span>
                  <span className={optEnd && optEnd.cumulative_cashflow >= 0 ? 'text-success' : 'text-destructive'}>
                    {formatGBP(optEnd?.cumulative_cashflow ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">End Equity</span>
                  <span>{formatGBP(optEnd?.equity ?? 0)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <ForecastChart
            results={result.results}
            scenarios={result.scenarios}
            title="Stress Test — Scenario Comparison"
          />

          {/* AI Commentary */}
          {result.ai_commentary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">AI Risk Assessment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {result.ai_commentary.split('\n\n').map((paragraph, i) => (
                    <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
