import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import {
  useAllLoanFacilities,
  fmtGBP,
} from '@/hooks/useLoanFacilities';
import {
  useLoanStressTest,
  usePortfolioStressTest,
} from '@/hooks/useRefinanceWorkflow';

export function LoanStressTest() {
  const { data: facilities = [] } = useAllLoanFacilities();
  const activeFacilities = useMemo(
    () => facilities.filter((f) => f.status === 'active'),
    [facilities]
  );

  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('');
  const [rateIncreaseBps, setRateIncreaseBps] = useState(100);
  const [portfolioBps, setPortfolioBps] = useState(100);

  const selectedFacility =
    activeFacilities.find((f) => f.id === selectedFacilityId) ?? null;

  const singleResult = useLoanStressTest(selectedFacility, rateIncreaseBps);
  const portfolioResult = usePortfolioStressTest(portfolioBps);

  // Build scenario grid for the selected facility
  const scenarios = useMemo(() => {
    if (!selectedFacility) return [];
    const bpsValues = [50, 100, 150, 200, 300, 500];
    return bpsValues.map((bps) => {
      const newRate = selectedFacility.interest_rate + bps / 100;
      const balance = selectedFacility.current_balance;
      let newPayment: number;

      if (
        selectedFacility.interest_only ||
        selectedFacility.repayment_type === 'interest_only'
      ) {
        newPayment = (balance * newRate) / 100 / 12;
      } else {
        const monthlyRate = newRate / 100 / 12;
        const termRemaining = Math.max(
          1,
          Math.ceil(
            (new Date(selectedFacility.term_end_date).getTime() - Date.now()) /
              (30 * 86_400_000)
          )
        );
        newPayment =
          monthlyRate > 0
            ? (balance * monthlyRate) /
              (1 - Math.pow(1 + monthlyRate, -termRemaining))
            : balance / termRemaining;
      }

      const currentPayment = selectedFacility.monthly_payment || 0;
      return {
        bps,
        newRate,
        newPayment,
        increase: newPayment - currentPayment,
        annualIncrease: (newPayment - currentPayment) * 12,
      };
    });
  }, [selectedFacility]);

  return (
    <div className="space-y-6">
      {/* Portfolio Stress Test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Portfolio Stress Test
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            If ALL variable/tracker rates increase by{' '}
            <span className="font-semibold text-foreground">
              {portfolioBps} bps ({(portfolioBps / 100).toFixed(2)}%)
            </span>
            {portfolioResult.fixedCount > 0 && (
              <span>
                {' '}
                — {portfolioResult.fixedCount} fixed facility(ies) unaffected
              </span>
            )}
          </p>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Rate Increase: {portfolioBps} bps
            </Label>
            <Slider
              value={[portfolioBps]}
              onValueChange={([v]) => setPortfolioBps(v)}
              min={25}
              max={500}
              step={25}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Current Monthly</p>
              <p className="text-lg font-semibold">
                {fmtGBP(portfolioResult.currentMonthly)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Stressed Monthly</p>
              <p className="text-lg font-semibold">
                {fmtGBP(portfolioResult.newMonthly)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Monthly Increase</p>
              <p className="text-lg font-semibold text-red-600">
                +{fmtGBP(portfolioResult.monthlyIncrease)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Annual Increase</p>
              <p className="text-lg font-semibold text-red-600">
                +{fmtGBP(portfolioResult.annualIncrease)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Single Loan Stress Test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Individual Loan Stress Test
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">
                Select Facility
              </Label>
              <Select
                value={selectedFacilityId}
                onValueChange={setSelectedFacilityId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a loan facility..." />
                </SelectTrigger>
                <SelectContent>
                  {activeFacilities.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.property_address} — {f.lender_name} (
                      {f.interest_rate.toFixed(2)}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedFacility && (
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">
                    Rate Increase: {rateIncreaseBps} bps (to{' '}
                    {(selectedFacility.interest_rate + rateIncreaseBps / 100).toFixed(
                      2
                    )}
                    %)
                  </Label>
                  <Slider
                    value={[rateIncreaseBps]}
                    onValueChange={([v]) => setRateIncreaseBps(v)}
                    min={25}
                    max={500}
                    step={25}
                  />
                </div>
              </div>
            )}
          </div>

          {singleResult && selectedFacility && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              <div>
                <p className="text-xs text-muted-foreground">Current Rate</p>
                <p className="text-lg font-semibold">
                  {selectedFacility.interest_rate.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Stressed Rate</p>
                <p className="text-lg font-semibold">
                  {singleResult.newRate.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">New Payment</p>
                <p className="text-lg font-semibold">
                  {fmtGBP(singleResult.newMonthlyPayment)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Monthly Increase</p>
                <p className="text-lg font-semibold text-red-600">
                  +{fmtGBP(singleResult.monthlyIncrease)}
                </p>
              </div>
            </div>
          )}

          {/* Scenario Grid */}
          {selectedFacility && scenarios.length > 0 && (
            <div className="pt-4">
              <h4 className="text-sm font-medium mb-3">Scenario Comparison</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-left">
                      <th className="pb-2 font-medium">Rate Increase</th>
                      <th className="pb-2 font-medium text-right">New Rate</th>
                      <th className="pb-2 font-medium text-right">
                        Monthly Payment
                      </th>
                      <th className="pb-2 font-medium text-right">
                        Monthly Increase
                      </th>
                      <th className="pb-2 font-medium text-right">
                        Annual Increase
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarios.map((s) => (
                      <tr
                        key={s.bps}
                        className={`border-b last:border-0 ${s.bps === rateIncreaseBps ? 'bg-blue-50/50 dark:bg-blue-950/20 font-medium' : ''}`}
                      >
                        <td className="py-2">
                          +{s.bps} bps
                          {s.bps === rateIncreaseBps && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              Selected
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          {s.newRate.toFixed(2)}%
                        </td>
                        <td className="py-2 text-right">
                          {fmtGBP(s.newPayment)}
                        </td>
                        <td className="py-2 text-right text-red-600">
                          +{fmtGBP(s.increase)}
                        </td>
                        <td className="py-2 text-right text-red-600">
                          +{fmtGBP(s.annualIncrease)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
