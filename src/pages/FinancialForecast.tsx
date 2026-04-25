import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, TrendingUp, Calendar, History, Trash2 } from 'lucide-react';
import { ForecastChart } from '@/components/finance/ForecastChart';
import { StressTestPanel } from '@/components/finance/StressTestPanel';
import {
  useFinancialForecasts,
  useForecastDetail,
  useRunForecast,
  type FinancialForecast as ForecastType,
} from '@/hooks/useFinancialForecasts';
import { format } from 'date-fns';
import { supabaseAny } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

function CashflowTab() {
  const [rentGrowth, setRentGrowth] = useState(2);
  const [voidRate, setVoidRate] = useState(5);
  const [maintenancePct, setMaintenancePct] = useState(1);
  const [rateChangeBps, setRateChangeBps] = useState(0);
  const [horizon, setHorizon] = useState<12 | 24 | 60>(24);

  const runForecast = useRunForecast();
  const [result, setResult] = useState<ForecastType | null>(null);

  const handleRun = async () => {
    const forecast = await runForecast.mutateAsync({
      forecast_type: 'cashflow',
      time_horizon_months: horizon,
      assumptions: {
        rent_growth_pct: rentGrowth,
        void_rate_pct: voidRate,
        maintenance_pct: maintenancePct,
        rate_change_bps: rateChangeBps,
      },
    });
    setResult(forecast);
  };

  return (
    <div className="space-y-6">
      {/* Assumptions Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Projection Assumptions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Rent Growth</label>
                <span className="text-sm text-muted-foreground">{rentGrowth > 0 ? '+' : ''}{rentGrowth}% p.a.</span>
              </div>
              <Slider
                value={[rentGrowth]}
                onValueChange={([v]) => setRentGrowth(v)}
                min={-5}
                max={10}
                step={0.5}
              />
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
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Maintenance Inflation</label>
                <span className="text-sm text-muted-foreground">+{maintenancePct}% p.a.</span>
              </div>
              <Slider
                value={[maintenancePct]}
                onValueChange={([v]) => setMaintenancePct(v)}
                min={0}
                max={10}
                step={0.5}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Rate Change</label>
                <span className="text-sm text-muted-foreground">{rateChangeBps > 0 ? '+' : ''}{rateChangeBps} bps</span>
              </div>
              <Slider
                value={[rateChangeBps]}
                onValueChange={([v]) => setRateChangeBps(v)}
                min={-200}
                max={400}
                step={25}
              />
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
            <Button onClick={handleRun} disabled={runForecast.isPending}>
              {runForecast.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Run Projection
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Chart + AI Commentary */}
      {result && (
        <>
          <ForecastChart results={result.results} title="Cashflow Projection" />

          {result.ai_commentary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">AI Commentary</CardTitle>
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

function SavedForecastsTab() {
  const { data: forecasts, isLoading } = useFinancialForecasts();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: detail } = useForecastDetail(selectedId ?? undefined);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = async (id: string) => {
    const { error } = await supabaseAny
      .from('financial_forecasts')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Failed to delete forecast', variant: 'destructive' });
    } else {
      toast({ title: 'Forecast deleted' });
      queryClient.invalidateQueries({ queryKey: ['financial-forecasts'] });
      if (selectedId === id) setSelectedId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  if (!forecasts?.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <History className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">No saved forecasts yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Run a cashflow projection or stress test to get started
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {forecasts.map((f) => (
          <Card
            key={f.id}
            className={`cursor-pointer transition-colors hover:bg-accent/50 ${
              selectedId === f.id ? 'border-primary' : ''
            }`}
            onClick={() => setSelectedId(selectedId === f.id ? null : f.id)}
          >
            <CardContent className="py-3 px-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{f.name}</p>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {f.forecast_type === 'stress_test' ? 'Stress Test' :
                     f.forecast_type === 'rate_scenario' ? 'Rate Scenario' : 'Cashflow'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(f.created_at), 'dd MMM yyyy HH:mm')}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); handleDelete(f.id); }}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {detail && (
        <>
          <ForecastChart
            results={detail.results}
            scenarios={detail.scenarios}
            title={detail.name}
          />

          {detail.ai_commentary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">AI Commentary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {detail.ai_commentary.split('\n\n').map((paragraph, i) => (
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

export default function FinancialForecast() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financial Forecast</h1>
          <p className="text-muted-foreground text-sm">
            AI-powered cashflow projections and stress testing for your portfolio
          </p>
        </div>

        <Tabs defaultValue="cashflow" className="space-y-4">
          <TabsList>
            <TabsTrigger value="cashflow" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Cashflow Projection
            </TabsTrigger>
            <TabsTrigger value="stress" className="gap-2">
              <Calendar className="h-4 w-4" />
              Stress Test
            </TabsTrigger>
            <TabsTrigger value="saved" className="gap-2">
              <History className="h-4 w-4" />
              Saved Forecasts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cashflow">
            <CashflowTab />
          </TabsContent>

          <TabsContent value="stress">
            <StressTestPanel />
          </TabsContent>

          <TabsContent value="saved">
            <SavedForecastsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
