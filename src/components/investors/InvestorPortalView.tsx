import { useMemo } from 'react';
import {
  TrendingUp, Building2, PiggyBank, FileText, Banknote, Calendar, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useInvestorCommitments, useInvestorDistributions, useInvestorReturnMetrics } from '@/hooks/useInvestorDetail';
import { useInvestorCapitalCallItems } from '@/hooks/useInvestorOnboarding';
import { useInvestorReports } from '@/hooks/useInvestorReports';
import { formatGBP } from '@/lib/calculations';

interface CommitmentRow {
  commitment_id: string;
  entity_name?: string;
  commitment_type?: string;
  drawn_amount?: number;
  equity_percentage?: number | null;
  status?: string;
}

interface ReturnMetricRow {
  commitment_id: string;
  current_equity_value?: number;
}

interface DistributionRow {
  id: string;
  distribution_date: string;
  distribution_type: string;
  amount: number;
  tax_deducted?: number;
  net_amount: number;
  period_from?: string | null;
  period_to?: string | null;
  status: string;
}

interface CapitalCallItemRow {
  id: string;
  amount: number;
  paid_amount?: number;
  status: string;
  capital_calls?: { title?: string; due_date?: string } | null;
}

interface ReportRow {
  id: string;
  title: string;
  report_period_from: string;
  report_period_to: string;
  generated_at?: string | null;
}

const DIST_TYPE_LABEL: Record<string, string> = {
  dividend: 'Dividend',
  interest: 'Interest',
  loan_repayment: 'Loan Repayment',
  profit_share: 'Profit Share',
  capital_return: 'Capital Return',
  other: 'Other',
};

export function InvestorPortalView({ investorId }: { investorId: string }) {
  const { data: commitments } = useInvestorCommitments(investorId);
  const { data: distributions } = useInvestorDistributions(investorId);
  const { data: returnMetrics } = useInvestorReturnMetrics(investorId);
  const { data: capitalCallItems } = useInvestorCapitalCallItems(investorId);
  const { data: reports } = useInvestorReports(investorId);

  // Portfolio summary
  const portfolio = useMemo(() => {
    const totalInvested = commitments?.reduce((s, c) => s + (c.drawn_amount || 0), 0) || 0;
    const currentValue = returnMetrics?.reduce((s, m) => s + (m.current_equity_value || 0), 0) || 0;
    const totalDistributed = distributions?.filter(d => d.status === 'paid').reduce((s, d) => s + d.amount, 0) || 0;
    const totalReturn = (currentValue + totalDistributed) - totalInvested;
    const totalReturnPct = totalInvested > 0 ? (totalReturn / totalInvested * 100) : 0;
    const irr = returnMetrics?.length
      ? returnMetrics.reduce((s, m) => s + ((m.equity_multiple || 0) * (m.capital_invested || 0)), 0) /
        Math.max(returnMetrics.reduce((s, m) => s + (m.capital_invested || 0), 0), 1)
      : 0;

    return { totalInvested, currentValue, totalDistributed, totalReturn, totalReturnPct, irr };
  }, [commitments, distributions, returnMetrics]);

  // Pending capital calls
  const pendingCalls = useMemo(() => {
    if (!capitalCallItems) return [];
    return capitalCallItems.filter(i => i.status === 'pending' || i.status === 'partial');
  }, [capitalCallItems]);

  return (
    <div className="space-y-6">
      {/* Portal Preview Banner */}
      <div className="bg-muted/50 border rounded-lg p-4 text-sm text-muted-foreground">
        This is a preview of what the investor would see in their portal. Actual portal login is a future feature.
      </div>

      {/* Portfolio Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={PiggyBank}
          label="Total Invested"
          value={formatGBP(portfolio.totalInvested)}
        />
        <SummaryCard
          icon={TrendingUp}
          label="Current Value"
          value={formatGBP(portfolio.currentValue)}
          subtext={portfolio.currentValue > portfolio.totalInvested ? 'Above cost' : 'Below cost'}
          subtextColor={portfolio.currentValue >= portfolio.totalInvested ? 'text-emerald-600' : 'text-destructive'}
        />
        <SummaryCard
          icon={Banknote}
          label="Total Distributions"
          value={formatGBP(portfolio.totalDistributed)}
        />
        <SummaryCard
          icon={TrendingUp}
          label="Total Return"
          value={formatGBP(portfolio.totalReturn)}
          subtext={`${portfolio.totalReturnPct >= 0 ? '+' : ''}${portfolio.totalReturnPct.toFixed(1)}% | ${portfolio.irr.toFixed(2)}x`}
          subtextColor={portfolio.totalReturn >= 0 ? 'text-emerald-600' : 'text-destructive'}
        />
      </div>

      {/* Property Investments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Property Investments
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property / Entity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Invested</TableHead>
                <TableHead className="text-right">Current Value</TableHead>
                <TableHead className="text-right">Equity %</TableHead>
                <TableHead className="text-right">Return</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!commitments || commitments.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No investments</TableCell>
                </TableRow>
              ) : (commitments as CommitmentRow[]).map((c) => {
                const metrics = (returnMetrics as ReturnMetricRow[] | undefined)?.find((m) => m.commitment_id === c.commitment_id);
                const gain = (metrics?.current_equity_value || 0) - (c.drawn_amount || 0);
                return (
                  <TableRow key={c.commitment_id}>
                    <TableCell className="font-medium">{c.entity_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{c.commitment_type}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatGBP(c.drawn_amount)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatGBP(metrics?.current_equity_value)}</TableCell>
                    <TableCell className="text-right">{c.equity_percentage ? `${c.equity_percentage}%` : '-'}</TableCell>
                    <TableCell className={`text-right font-mono text-sm font-semibold ${gain >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                      <span className="inline-flex items-center gap-0.5">
                        {gain >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {formatGBP(Math.abs(gain))}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        c.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : ''
                      }>
                        {c.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Distribution History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Distribution History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!distributions || distributions.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No distributions yet</TableCell>
                </TableRow>
              ) : (distributions as DistributionRow[]).map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-sm">{format(new Date(d.distribution_date), 'dd MMM yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{DIST_TYPE_LABEL[d.distribution_type] || d.distribution_type}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatGBP(d.amount)}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">{formatGBP(d.tax_deducted)}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold">{formatGBP(d.net_amount)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {d.period_from && d.period_to
                      ? `${format(new Date(d.period_from), 'MMM yy')} - ${format(new Date(d.period_to), 'MMM yy')}`
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={d.status === 'paid' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : ''}>
                      {d.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Capital Call Status */}
      {pendingCalls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Outstanding Capital Calls
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Capital Call</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Called</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(pendingCalls as CapitalCallItemRow[]).map((item) => {
                  const outstanding = item.amount - (item.paid_amount || 0);
                  const isOverdue = item.capital_calls?.due_date && new Date(item.capital_calls.due_date) < new Date();
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.capital_calls?.title || 'Unknown'}</TableCell>
                      <TableCell className={`text-sm ${isOverdue ? 'text-destructive font-semibold' : ''}`}>
                        {item.capital_calls?.due_date ? format(new Date(item.capital_calls.due_date), 'dd MMM yyyy') : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatGBP(item.amount)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatGBP(item.paid_amount)}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold text-amber-600">{formatGBP(outstanding)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={isOverdue
                          ? 'bg-destructive/10 text-destructive border-destructive/20'
                          : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                        }>
                          {isOverdue ? 'Overdue' : item.status === 'partial' ? 'Partial' : 'Pending'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Available Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Reports & Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Report</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Generated</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!reports || reports.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No reports available</TableCell>
                </TableRow>
              ) : (reports as ReportRow[]).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(r.report_period_from), 'MMM yyyy')} - {format(new Date(r.report_period_to), 'MMM yyyy')}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.generated_at ? format(new Date(r.generated_at), 'dd MMM yyyy') : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                      Available
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Summary Card ──

function SummaryCard({
  icon: Icon,
  label,
  value,
  subtext,
  subtextColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subtext?: string;
  subtextColor?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtext && <p className={`text-xs mt-0.5 ${subtextColor || 'text-muted-foreground'}`}>{subtext}</p>}
          </div>
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}
