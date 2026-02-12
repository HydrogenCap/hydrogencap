import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { useProperties } from '@/hooks/useProperties';
import { calculateLTV, calculateEquity, calculateMonthlyCashflowAfterDebt, calculateNetRent, getEffectiveCosts, formatGBP, formatPercent } from '@/lib/calculations';

export function StressTestPanel() {
  const { data: properties } = useProperties();

  const [rateChange, setRateChange] = useState(0); // basis points, e.g. +200 = +2%
  const [valueChange, setValueChange] = useState(0); // percentage change, e.g. -20 = -20%
  const [voidRate, setVoidRate] = useState(0); // percentage of rent lost to voids

  const scenarios = useMemo(() => {
    if (!properties?.length) return null;

    const currentYear = new Date().getFullYear();
    let basePortfolio = { totalValue: 0, totalDebt: 0, totalEquity: 0, totalCashflow: 0, totalRent: 0, avgLtv: 0, propertiesUnderwater: 0 };
    let stressedPortfolio = { ...basePortfolio };

    properties.forEach(prop => {
      const loan = prop.loans?.[0];
      const income = prop.income?.find(i => i.year === currentYear);
      const costs = prop.costs?.find(c => c.year === currentYear);

      const value = prop.current_value_gbp ? Number(prop.current_value_gbp) : 0;
      const mortgage = loan?.current_mortgage_balance_gbp ? Number(loan.current_mortgage_balance_gbp) : 0;
      const annualRent = income?.annual_rent_gbp ? Number(income.annual_rent_gbp) : 0;
      const rate = loan?.interest_rate_percent ? Number(loan.interest_rate_percent) : 0;
      const mortgagePayment = loan?.mortgage_payment_gbp ? Number(loan.mortgage_payment_gbp) : null;
      const effectiveCosts = getEffectiveCosts(annualRent, value, costs);

      // Base
      const baseEquity = value - mortgage;
      const baseLtv = value > 0 ? (mortgage / value) * 100 : 0;
      const baseNetRent = annualRent - effectiveCosts.total;
      const baseMonthlyCf = calculateMonthlyCashflowAfterDebt(annualRent, effectiveCosts.total, mortgagePayment);

      basePortfolio.totalValue += value;
      basePortfolio.totalDebt += mortgage;
      basePortfolio.totalEquity += baseEquity;
      basePortfolio.totalRent += annualRent;
      basePortfolio.totalCashflow += (baseMonthlyCf || 0) * 12;

      // Stressed
      const stressedValue = value * (1 + valueChange / 100);
      const stressedEquity = stressedValue - mortgage;
      const stressedRent = annualRent * (1 - voidRate / 100);
      const newRate = rate + rateChange / 100;
      const stressedMonthlyPayment = mortgagePayment
        ? (mortgage * (newRate / 100 / 12)) // Simple interest-only approximation
        : null;
      const stressedCosts = getEffectiveCosts(stressedRent, stressedValue, costs);
      const stressedMonthlyCf = calculateMonthlyCashflowAfterDebt(stressedRent, stressedCosts.total, stressedMonthlyPayment);

      stressedPortfolio.totalValue += stressedValue;
      stressedPortfolio.totalDebt += mortgage;
      stressedPortfolio.totalEquity += stressedEquity;
      stressedPortfolio.totalRent += stressedRent;
      stressedPortfolio.totalCashflow += (stressedMonthlyCf || 0) * 12;
      if (stressedEquity < 0) stressedPortfolio.propertiesUnderwater++;
    });

    basePortfolio.avgLtv = basePortfolio.totalValue > 0 ? (basePortfolio.totalDebt / basePortfolio.totalValue) * 100 : 0;
    stressedPortfolio.avgLtv = stressedPortfolio.totalValue > 0 ? (stressedPortfolio.totalDebt / stressedPortfolio.totalValue) * 100 : 0;

    return { base: basePortfolio, stressed: stressedPortfolio };
  }, [properties, rateChange, valueChange, voidRate]);

  if (!properties?.length || !scenarios) return null;

  const isStressed = rateChange !== 0 || valueChange !== 0 || voidRate !== 0;
  const equityDelta = scenarios.stressed.totalEquity - scenarios.base.totalEquity;
  const cashflowDelta = scenarios.stressed.totalCashflow - scenarios.base.totalCashflow;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5" />
          Portfolio Stress Test
        </CardTitle>
        <CardDescription>Model the impact of rate rises, value drops, and void periods</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sliders */}
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Interest Rate Change</Label>
              <Badge variant={rateChange > 0 ? 'destructive' : 'secondary'}>
                {rateChange > 0 ? '+' : ''}{(rateChange / 100).toFixed(1)}%
              </Badge>
            </div>
            <Slider
              value={[rateChange]}
              onValueChange={([v]) => setRateChange(v)}
              min={-200}
              max={500}
              step={25}
            />
            <p className="text-xs text-muted-foreground">-2% to +5% in 0.25% steps</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Property Values</Label>
              <Badge variant={valueChange < 0 ? 'destructive' : 'secondary'}>
                {valueChange > 0 ? '+' : ''}{valueChange}%
              </Badge>
            </div>
            <Slider
              value={[valueChange]}
              onValueChange={([v]) => setValueChange(v)}
              min={-40}
              max={20}
              step={5}
            />
            <p className="text-xs text-muted-foreground">-40% to +20%</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Void Rate</Label>
              <Badge variant={voidRate > 0 ? 'destructive' : 'secondary'}>
                {voidRate}%
              </Badge>
            </div>
            <Slider
              value={[voidRate]}
              onValueChange={([v]) => setVoidRate(v)}
              min={0}
              max={50}
              step={5}
            />
            <p className="text-xs text-muted-foreground">0% to 50% rent lost</p>
          </div>
        </div>

        {/* Results comparison */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="border rounded-lg p-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Current Position</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Portfolio Value</span><span className="font-medium">{formatGBP(scenarios.base.totalValue)}</span></div>
              <div className="flex justify-between"><span>Total Equity</span><span className="font-medium">{formatGBP(scenarios.base.totalEquity)}</span></div>
              <div className="flex justify-between"><span>Average LTV</span><span className="font-medium">{formatPercent(scenarios.base.avgLtv)}</span></div>
              <div className="flex justify-between"><span>Annual Cashflow</span><span className="font-medium">{formatGBP(scenarios.base.totalCashflow)}</span></div>
            </div>
          </div>

          <div className={`border rounded-lg p-4 ${isStressed ? 'border-destructive/50 bg-destructive/5' : ''}`}>
            <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              Stressed Position
              {isStressed && scenarios.stressed.propertiesUnderwater > 0 && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {scenarios.stressed.propertiesUnderwater} underwater
                </Badge>
              )}
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Portfolio Value</span>
                <span className="font-medium">{formatGBP(scenarios.stressed.totalValue)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Equity</span>
                <span className={`font-medium ${equityDelta < 0 ? 'text-destructive' : ''}`}>
                  {formatGBP(scenarios.stressed.totalEquity)}
                  {isStressed && <span className="ml-1 text-xs">({equityDelta >= 0 ? '+' : ''}{formatGBP(equityDelta)})</span>}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Average LTV</span>
                <span className={`font-medium ${scenarios.stressed.avgLtv > 85 ? 'text-destructive' : ''}`}>
                  {formatPercent(scenarios.stressed.avgLtv)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Annual Cashflow</span>
                <span className={`font-medium ${scenarios.stressed.totalCashflow < 0 ? 'text-destructive' : ''}`}>
                  {formatGBP(scenarios.stressed.totalCashflow)}
                  {isStressed && <span className="ml-1 text-xs">({cashflowDelta >= 0 ? '+' : ''}{formatGBP(cashflowDelta)})</span>}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
