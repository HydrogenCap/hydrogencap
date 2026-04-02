import { Scale } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { type PortfolioInsights } from '@/lib/portfolioInsights';
import { formatPercent } from '@/lib/calculations';

interface DebtRefinanceCardProps {
  portfolioInsights: PortfolioInsights;
  navigate: (path: string) => void;
}

export function DebtRefinanceCard({ portfolioInsights, navigate }: DebtRefinanceCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Scale className="h-4 w-4" />
          Debt & Refinance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <button
              onClick={() => portfolioInsights.debt.expiringIn3Months.count > 0 && navigate('/properties?filter=rate_expiry_3m')}
              className={`text-2xl font-bold text-destructive ${portfolioInsights.debt.expiringIn3Months.count > 0 ? 'hover:underline cursor-pointer' : ''}`}
              disabled={portfolioInsights.debt.expiringIn3Months.count === 0}
            >
              {portfolioInsights.debt.expiringIn3Months.count}
            </button>
            <div className="text-xs text-muted-foreground">Expiring 3mo</div>
            <div className="text-xs text-muted-foreground">
              {formatPercent(portfolioInsights.debt.expiringIn3Months.percent, 0)} of debt
            </div>
          </div>
          <div>
            <button
              onClick={() => portfolioInsights.debt.expiringIn6Months.count > 0 && navigate('/properties?filter=rate_expiry_6m')}
              className={`text-2xl font-bold text-warning ${portfolioInsights.debt.expiringIn6Months.count > 0 ? 'hover:underline cursor-pointer' : ''}`}
              disabled={portfolioInsights.debt.expiringIn6Months.count === 0}
            >
              {portfolioInsights.debt.expiringIn6Months.count}
            </button>
            <div className="text-xs text-muted-foreground">Expiring 6mo</div>
            <div className="text-xs text-muted-foreground">
              {formatPercent(portfolioInsights.debt.expiringIn6Months.percent, 0)} of debt
            </div>
          </div>
          <div>
            <button
              onClick={() => portfolioInsights.debt.expiringIn12Months.count > 0 && navigate('/properties?filter=rate_expiry_12m')}
              className={`text-2xl font-bold ${portfolioInsights.debt.expiringIn12Months.count > 0 ? 'hover:underline cursor-pointer' : ''}`}
              disabled={portfolioInsights.debt.expiringIn12Months.count === 0}
            >
              {portfolioInsights.debt.expiringIn12Months.count}
            </button>
            <div className="text-xs text-muted-foreground">Expiring 12mo</div>
            <div className="text-xs text-muted-foreground">
              {formatPercent(portfolioInsights.debt.expiringIn12Months.percent, 0)} of debt
            </div>
          </div>
        </div>

        <Separator />

        <div>
          <div className="text-sm font-medium mb-2">Lender Concentration</div>
          {portfolioInsights.debt.lenderConcentration.length > 0 ? (
            <div className="space-y-2">
              {portfolioInsights.debt.lenderConcentration.map((lender, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span>{lender.lender}</span>
                  <div className="flex items-center gap-2">
                    <Progress value={lender.percent} className="w-24 h-2" />
                    <span className="w-12 text-right text-muted-foreground">
                      {formatPercent(lender.percent, 0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No lenders recorded</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
