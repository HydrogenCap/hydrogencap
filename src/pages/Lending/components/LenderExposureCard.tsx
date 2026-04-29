import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LENDER_TYPES } from '@/hooks/useLenders';
import { fmtGBP, fmtDate, type PortfolioDebtSummary } from '@/hooks/useLoanFacilities';

export function LenderExposureCard({
  debtSummary, totalDebt,
}: { debtSummary: PortfolioDebtSummary[]; totalDebt: number }) {
  return (
    <Card>
      <CardHeader><CardTitle>Lender Exposure</CardTitle></CardHeader>
      <CardContent>
        {debtSummary.length === 0 ? (
          <p className="text-muted-foreground text-center py-6">No lenders configured yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-left">
                  <th className="pb-2 font-medium">Lender</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium text-right">Facilities</th>
                  <th className="pb-2 font-medium text-right">Exposure</th>
                  <th className="pb-2 font-medium text-right">% of Debt</th>
                  <th className="pb-2 font-medium text-right">Avg Rate</th>
                  <th className="pb-2 font-medium text-right">Rate Expiry</th>
                  <th className="pb-2 font-medium text-right">Term End</th>
                </tr>
              </thead>
              <tbody>
                {debtSummary
                  .sort((a, b) => Number(b.total_exposure) - Number(a.total_exposure))
                  .map(row => {
                    const pct = totalDebt > 0 ? (Number(row.total_exposure) / totalDebt * 100) : 0;
                    const pctColor = pct >= 40 ? 'text-red-600 font-semibold' : pct >= 25 ? 'text-amber-600' : 'text-emerald-600';
                    return (
                      <tr key={row.lender_id} className="border-b last:border-0">
                        <td className="py-2 font-medium text-foreground">{row.lender_name}</td>
                        <td className="py-2"><Badge variant="outline">{LENDER_TYPES.find(t => t.value === row.lender_type)?.label || row.lender_type}</Badge></td>
                        <td className="py-2 text-right">{row.facility_count}</td>
                        <td className="py-2 text-right font-medium">{fmtGBP(Number(row.total_exposure))}</td>
                        <td className={`py-2 text-right ${pctColor}`}>{pct.toFixed(1)}%</td>
                        <td className="py-2 text-right">{Number(row.avg_interest_rate).toFixed(2)}%</td>
                        <td className="py-2 text-right">{fmtDate(row.nearest_rate_expiry)}</td>
                        <td className="py-2 text-right">{fmtDate(row.nearest_term_end)}</td>
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
