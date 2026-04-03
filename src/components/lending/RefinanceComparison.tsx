import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Trophy } from 'lucide-react';
import {
  useRefinanceComparison,
  useCreateApplication,
  type ComparisonProduct,
} from '@/hooks/useRefinanceWorkflow';
import { type LoanFacilityWithDetails, fmtGBP } from '@/hooks/useLoanFacilities';

interface Props {
  facility?: LoanFacilityWithDetails | null;
  onApplicationCreated?: () => void;
}

const emptyProduct = (): ComparisonProduct => ({
  id: crypto.randomUUID(),
  lender: '',
  rate: 0,
  termMonths: 24,
  arrangementFee: 0,
  valuationFee: 0,
  legalFee: 0,
  brokerFee: 0,
});

export function RefinanceComparison({ facility, onApplicationCreated }: Props) {
  const [products, setProducts] = useState<ComparisonProduct[]>([emptyProduct()]);
  const createApp = useCreateApplication();

  const currentBalance = facility?.current_balance ?? 0;
  const currentRate = facility?.interest_rate ?? 0;
  const currentPayment = facility?.monthly_payment ?? 0;

  const results = useRefinanceComparison(
    currentBalance,
    currentRate,
    currentPayment,
    products.filter((p) => p.rate > 0)
  );

  const bestIdx =
    results.length > 0
      ? results.reduce(
          (best, r, i) =>
            r.totalSavingOverTerm > (results[best]?.totalSavingOverTerm ?? -Infinity) ? i : best,
          0
        )
      : -1;

  const addProduct = useCallback(() => {
    if (products.length >= 5) return;
    setProducts((prev) => [...prev, emptyProduct()]);
  }, [products.length]);

  const removeProduct = useCallback((id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const updateProduct = useCallback(
    (id: string, field: keyof ComparisonProduct, value: string | number) => {
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
      );
    },
    []
  );

  const handleStartApplication = useCallback(
    async (product: ComparisonProduct) => {
      if (!facility) return;
      const result = results.find((r) => r.id === product.id);
      await createApp.mutateAsync({
        property_id: facility.property_id,
        existing_loan_id: facility.id,
        status: 'researching',
        lender_name: product.lender,
        product_name: null,
        product_rate: product.rate,
        product_type: null,
        product_term_months: product.termMonths,
        erc_end_date: null,
        arrangement_fee: product.arrangementFee,
        valuation_fee: product.valuationFee,
        legal_fee: product.legalFee,
        loan_amount: currentBalance,
        property_value: null,
        ltv: null,
        broker_name: null,
        broker_company: null,
        broker_fee: product.brokerFee,
        dip_submitted_at: null,
        dip_approved_at: null,
        full_app_submitted_at: null,
        valuation_date: null,
        offer_date: null,
        completion_target: null,
        completed_at: null,
        current_rate: currentRate,
        current_payment: currentPayment,
        new_payment: result?.monthlyPayment ?? null,
        monthly_saving: result?.monthlySaving ?? null,
        total_cost_of_switch: result ? result.totalFees - result.totalSavingOverTerm : null,
        notes: null,
      });
      onApplicationCreated?.();
    },
    [facility, results, currentBalance, currentRate, currentPayment, createApp, onApplicationCreated]
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Refinance Comparison</CardTitle>
          {facility && (
            <Badge variant="outline">
              Current: {currentRate.toFixed(2)}% · {fmtGBP(currentPayment)}/mo
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!facility && (
          <p className="text-sm text-muted-foreground">
            Select a loan facility to compare refinance options.
          </p>
        )}

        {/* Product Inputs */}
        <div className="space-y-4">
          {products.map((p, idx) => (
            <div
              key={p.id}
              className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 items-end p-3 rounded-lg border"
            >
              <div className="col-span-2 md:col-span-4 lg:col-span-8 flex items-center justify-between">
                <span className="text-sm font-medium">Option {idx + 1}</span>
                {products.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeProduct(p.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div>
                <Label className="text-xs">Lender</Label>
                <Input
                  value={p.lender}
                  onChange={(e) => updateProduct(p.id, 'lender', e.target.value)}
                  placeholder="Lender name"
                />
              </div>
              <div>
                <Label className="text-xs">Rate (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={p.rate || ''}
                  onChange={(e) =>
                    updateProduct(p.id, 'rate', parseFloat(e.target.value) || 0)
                  }
                  placeholder="4.25"
                />
              </div>
              <div>
                <Label className="text-xs">Term (months)</Label>
                <Input
                  type="number"
                  value={p.termMonths || ''}
                  onChange={(e) =>
                    updateProduct(p.id, 'termMonths', parseInt(e.target.value) || 0)
                  }
                  placeholder="24"
                />
              </div>
              <div>
                <Label className="text-xs">Arrangement Fee</Label>
                <Input
                  type="number"
                  value={p.arrangementFee || ''}
                  onChange={(e) =>
                    updateProduct(
                      p.id,
                      'arrangementFee',
                      parseFloat(e.target.value) || 0
                    )
                  }
                  placeholder="999"
                />
              </div>
              <div>
                <Label className="text-xs">Valuation Fee</Label>
                <Input
                  type="number"
                  value={p.valuationFee || ''}
                  onChange={(e) =>
                    updateProduct(
                      p.id,
                      'valuationFee',
                      parseFloat(e.target.value) || 0
                    )
                  }
                  placeholder="500"
                />
              </div>
              <div>
                <Label className="text-xs">Legal Fee</Label>
                <Input
                  type="number"
                  value={p.legalFee || ''}
                  onChange={(e) =>
                    updateProduct(p.id, 'legalFee', parseFloat(e.target.value) || 0)
                  }
                  placeholder="1000"
                />
              </div>
              <div>
                <Label className="text-xs">Broker Fee</Label>
                <Input
                  type="number"
                  value={p.brokerFee || ''}
                  onChange={(e) =>
                    updateProduct(p.id, 'brokerFee', parseFloat(e.target.value) || 0)
                  }
                  placeholder="0"
                />
              </div>
            </div>
          ))}

          {products.length < 5 && (
            <Button variant="outline" size="sm" onClick={addProduct}>
              <Plus className="h-4 w-4 mr-1" /> Add Option
            </Button>
          )}
        </div>

        {/* Comparison Table */}
        {results.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-left">
                  <th className="pb-2 font-medium"></th>
                  <th className="pb-2 font-medium">Lender</th>
                  <th className="pb-2 font-medium text-right">Monthly Payment</th>
                  <th className="pb-2 font-medium text-right">Monthly Saving</th>
                  <th className="pb-2 font-medium text-right">Total Fees</th>
                  <th className="pb-2 font-medium text-right">Breakeven</th>
                  <th className="pb-2 font-medium text-right">Total Saving</th>
                  <th className="pb-2 font-medium text-right">Eff. Rate</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const isBest = i === bestIdx;
                  return (
                    <tr
                      key={r.id}
                      className={`border-b last:border-0 ${isBest ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : ''}`}
                    >
                      <td className="py-2">
                        {isBest && (
                          <Trophy className="h-4 w-4 text-emerald-600" />
                        )}
                      </td>
                      <td className="py-2 font-medium">
                        {r.lender || `Option ${i + 1}`}
                        {isBest && (
                          <Badge className="ml-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            Best
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 text-right">{fmtGBP(r.monthlyPayment)}</td>
                      <td
                        className={`py-2 text-right font-medium ${r.monthlySaving > 0 ? 'text-emerald-600' : 'text-red-600'}`}
                      >
                        {r.monthlySaving > 0 ? '+' : ''}
                        {fmtGBP(r.monthlySaving)}
                      </td>
                      <td className="py-2 text-right">{fmtGBP(r.totalFees)}</td>
                      <td className="py-2 text-right">
                        {r.breakevenMonth === Infinity
                          ? 'Never'
                          : `${r.breakevenMonth} mo`}
                      </td>
                      <td
                        className={`py-2 text-right font-medium ${r.totalSavingOverTerm > 0 ? 'text-emerald-600' : 'text-red-600'}`}
                      >
                        {fmtGBP(r.totalSavingOverTerm)}
                      </td>
                      <td className="py-2 text-right">{r.effectiveRate.toFixed(2)}%</td>
                      <td className="py-2 text-right">
                        {facility && (
                          <Button
                            size="sm"
                            variant={isBest ? 'default' : 'outline'}
                            disabled={createApp.isPending}
                            onClick={() => handleStartApplication(products.find((pp) => pp.id === r.id)!)}
                          >
                            Start Application
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
