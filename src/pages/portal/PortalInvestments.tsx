import { useMemo } from 'react';
import { Wallet, TrendingUp, PoundSterling, ArrowDownRight, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { usePortalInvestorData } from '@/hooks/usePortalInvestorData';
import { LoadingState } from '@/components/common/LoadingState';
import { format } from 'date-fns';

function fmt(amount: number | null | undefined): string {
  return `£${(amount || 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const COMMITMENT_TYPE_LABEL: Record<string, string> = {
  equity: 'Equity',
  loan: 'Loan',
  convertible_loan: 'Convertible Loan',
  preference_shares: 'Preference Shares',
  mezzanine: 'Mezzanine',
};

const DIST_TYPE_LABEL: Record<string, string> = {
  dividend: 'Dividend',
  interest: 'Interest',
  loan_repayment: 'Loan Repayment',
  profit_share: 'Profit Share',
  capital_return: 'Capital Return',
  other: 'Other',
};

export default function PortalInvestments() {
  const { commitments, distributions, returnMetrics, stats, isLoading } = usePortalInvestorData();

  if (isLoading) {
    return (
      <PortalLayout>
        <LoadingState text="Loading investments..." />
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Investments</h1>
          <p className="text-muted-foreground">Your capital commitments, distributions, and return metrics</p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Committed</CardTitle>
              <PoundSterling className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmt(stats.totalCommitted)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Capital Deployed</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmt(stats.totalDrawn)}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totalCommitted > 0 ? `${((stats.totalDrawn / stats.totalCommitted) * 100).toFixed(0)}% deployed` : '—'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Equity Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{fmt(stats.totalEquityValue)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Distributions</CardTitle>
              <ArrowDownRight className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{fmt(stats.totalDistributed)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Equity Multiple</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.weightedMultiple.toFixed(2)}x</div>
            </CardContent>
          </Card>
        </div>

        {/* Commitments Table */}
        <Card>
          <CardHeader>
            <CardTitle>Capital Commitments</CardTitle>
            <CardDescription>Your investment positions across entities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Entity</th>
                    <th className="text-left py-3 px-2 font-medium">Type</th>
                    <th className="text-right py-3 px-2 font-medium">Committed</th>
                    <th className="text-right py-3 px-2 font-medium">Drawn</th>
                    <th className="text-right py-3 px-2 font-medium">Equity %</th>
                    <th className="text-right py-3 px-2 font-medium">Value Share</th>
                    <th className="text-left py-3 px-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {commitments?.map((c: any, i: number) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-3 px-2 font-medium">{c.entity_name || '—'}</td>
                      <td className="py-3 px-2">
                        <Badge variant="outline">
                          {COMMITMENT_TYPE_LABEL[c.commitment_type] || c.commitment_type || '—'}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-right">{fmt(c.committed_amount)}</td>
                      <td className="py-3 px-2 text-right">{fmt(c.drawn_amount)}</td>
                      <td className="py-3 px-2 text-right">{c.equity_percentage ? `${c.equity_percentage}%` : '—'}</td>
                      <td className="py-3 px-2 text-right">{fmt(c.investors_share_valuation)}</td>
                      <td className="py-3 px-2">
                        <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                          {(c.status || 'active').replace(/_/g, ' ')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {(!commitments || commitments.length === 0) && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">No commitments found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Return Metrics */}
        {returnMetrics && returnMetrics.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Return Metrics</CardTitle>
              <CardDescription>Performance by entity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium">Entity</th>
                      <th className="text-right py-3 px-2 font-medium">Capital Invested</th>
                      <th className="text-right py-3 px-2 font-medium">Distributions</th>
                      <th className="text-right py-3 px-2 font-medium">Equity Value</th>
                      <th className="text-right py-3 px-2 font-medium">Cash-on-Cash</th>
                      <th className="text-right py-3 px-2 font-medium">Multiple</th>
                      <th className="text-right py-3 px-2 font-medium">Unrealised G/L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnMetrics.map((m: any, i: number) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-3 px-2 font-medium">{m.entity_name || '—'}</td>
                        <td className="py-3 px-2 text-right">{fmt(m.capital_invested)}</td>
                        <td className="py-3 px-2 text-right">{fmt(m.total_distributions)}</td>
                        <td className="py-3 px-2 text-right">{fmt(m.current_equity_value)}</td>
                        <td className="py-3 px-2 text-right">{(m.cash_on_cash_pct || 0).toFixed(1)}%</td>
                        <td className="py-3 px-2 text-right">
                          <span className={`font-medium ${(m.equity_multiple || 0) >= 1.5 ? 'text-success' : (m.equity_multiple || 0) >= 1 ? 'text-warning' : 'text-destructive'}`}>
                            {(m.equity_multiple || 0).toFixed(2)}x
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className={(m.unrealised_gain_loss || 0) >= 0 ? 'text-success' : 'text-destructive'}>
                            {fmt(m.unrealised_gain_loss)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Distributions */}
        {distributions && distributions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Distribution History</CardTitle>
              <CardDescription>Recent payouts and income received</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium">Date</th>
                      <th className="text-left py-3 px-2 font-medium">Type</th>
                      <th className="text-right py-3 px-2 font-medium">Gross</th>
                      <th className="text-right py-3 px-2 font-medium">Tax</th>
                      <th className="text-right py-3 px-2 font-medium">Net</th>
                      <th className="text-left py-3 px-2 font-medium">Reference</th>
                      <th className="text-left py-3 px-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {distributions.map((d: any, i: number) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-3 px-2">{format(new Date(d.distribution_date), 'dd MMM yyyy')}</td>
                        <td className="py-3 px-2">{DIST_TYPE_LABEL[d.distribution_type] || d.distribution_type}</td>
                        <td className="py-3 px-2 text-right">{fmt(d.amount)}</td>
                        <td className="py-3 px-2 text-right">{fmt(d.tax_deducted)}</td>
                        <td className="py-3 px-2 text-right font-medium">{fmt(d.net_amount || (d.amount - (d.tax_deducted || 0)))}</td>
                        <td className="py-3 px-2 text-muted-foreground">{d.payment_reference || '—'}</td>
                        <td className="py-3 px-2">
                          <Badge variant={d.status === 'paid' ? 'default' : 'secondary'} className="capitalize">
                            {d.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PortalLayout>
  );
}
