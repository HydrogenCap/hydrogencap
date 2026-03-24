import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Plus, Mail, Phone, ShieldCheck, Award, FileText, Download } from 'lucide-react';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useInvestors, useSendInvestorPortalAccessEmail, Investor } from '@/hooks/useInvestors';
import { useInvestorCommitments, useInvestorDistributions, useInvestorReturnMetrics } from '@/hooks/useInvestorDetail';
import { useInvestorReports } from '@/hooks/useInvestorReports';
import { useDownloadFile } from '@/hooks/useSignedUrl';
import { formatGBP } from '@/lib/calculations';
import { InvestorFormModal } from '@/components/investors/InvestorFormModal';
import { CommitmentFormModal } from '@/components/investors/CommitmentFormModal';
import { DistributionFormModal } from '@/components/investors/DistributionFormModal';
import { InvestorReportModal } from '@/components/investors/InvestorReportModal';

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  individual: { label: 'Individual', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  company: { label: 'Company', className: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
  trust: { label: 'Trust', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  family_office: { label: 'Family Office', className: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  fund: { label: 'Fund', className: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' },
  jv_partner: { label: 'JV Partner', className: 'bg-teal-500/10 text-teal-600 border-teal-500/20' },
};

const COMMITMENT_TYPE_LABEL: Record<string, string> = {
  equity: 'Equity',
  loan: 'Loan',
  convertible_loan: 'Convertible',
  preference_shares: 'Preference',
  mezzanine: 'Mezzanine',
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  fully_drawn: { label: 'Fully Drawn', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  partially_returned: { label: 'Partial Return', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  fully_returned: { label: 'Fully Returned', className: 'bg-muted text-muted-foreground border-border' },
  defaulted: { label: 'Defaulted', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const DIST_TYPE_LABEL: Record<string, string> = {
  dividend: 'Dividend',
  interest: 'Interest',
  loan_repayment: 'Loan Repayment',
  profit_share: 'Profit Share',
  capital_return: 'Capital Return',
  other: 'Other',
};

function fmt(amount: number | null | undefined): string {
  return formatGBP(amount || 0);
}

export default function InvestorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: investors, isLoading: investorsLoading } = useInvestors();
  const { data: commitments, isLoading: commitmentsLoading } = useInvestorCommitments(id);
  const { data: distributions } = useInvestorDistributions(id);
  const { data: returnMetrics } = useInvestorReturnMetrics(id);
  const { data: reports } = useInvestorReports(id);
  const { download: downloadInvestorReport, downloading: downloadingInvestorReport } = useDownloadFile('investor-reports');
  const sendPortalAccessEmail = useSendInvestorPortalAccessEmail();

  const [showEditModal, setShowEditModal] = useState(false);
  const [showCommitmentModal, setShowCommitmentModal] = useState(false);
  const [showDistributionModal, setShowDistributionModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const investor = useMemo(() => investors?.find(i => i.id === id), [investors, id]);

  // KPIs
  const kpis = useMemo(() => {
    const totalCommitted = commitments?.reduce((s, c) => s + (c.committed_amount || 0), 0) || 0;
    const totalDrawn = commitments?.reduce((s, c) => s + (c.drawn_amount || 0), 0) || 0;
    const totalEquityValue = returnMetrics?.reduce((s, m) => s + (m.current_equity_value || 0), 0) || 0;
    const totalDistributed = distributions?.filter(d => d.status === 'paid').reduce((s, d) => s + d.amount, 0) || 0;
    const weightedMultiple = returnMetrics?.length
      ? returnMetrics.reduce((s, m) => s + (m.equity_multiple || 0) * (m.capital_invested || 0), 0) /
        Math.max(returnMetrics.reduce((s, m) => s + (m.capital_invested || 0), 0), 1)
      : 0;
    return { totalCommitted, totalDrawn, totalEquityValue, totalDistributed, weightedMultiple };
  }, [commitments, distributions, returnMetrics]);

  // Distribution stats
  const distStats = useMemo(() => {
    if (!distributions) return { allTime: 0, thisYear: 0, lastYear: 0, yield: 0 };
    const paid = distributions.filter(d => d.status === 'paid');
    const thisYear = new Date().getFullYear();
    const allTime = paid.reduce((s, d) => s + d.amount, 0);
    const thisYearTotal = paid.filter(d => new Date(d.distribution_date).getFullYear() === thisYear).reduce((s, d) => s + d.amount, 0);
    const lastYearTotal = paid.filter(d => new Date(d.distribution_date).getFullYear() === thisYear - 1).reduce((s, d) => s + d.amount, 0);
    const yieldPct = kpis.totalDrawn > 0 ? (thisYearTotal / kpis.totalDrawn * 100) : 0;
    return { allTime, thisYear: thisYearTotal, lastYear: lastYearTotal, yield: yieldPct };
  }, [distributions, kpis.totalDrawn]);

  // Commitment options for distribution modal
  const commitmentOptions = useMemo(() =>
    (commitments || []).map(c => ({
      id: c.commitment_id!,
      entity_name: c.entity_name || '',
      commitment_type: COMMITMENT_TYPE_LABEL[c.commitment_type || ''] || c.commitment_type || '',
      entity_id: c.entity_id!,
    })),
    [commitments]
  );

  if (investorsLoading || commitmentsLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      </AppLayout>
    );
  }

  if (!investor) {
    return (
      <AppLayout>
        <div className="text-center py-16 text-muted-foreground">Investor not found.</div>
      </AppLayout>
    );
  }

  const typeConfig = TYPE_BADGE[investor.investor_type] || TYPE_BADGE.individual;
  const multipleColor = kpis.weightedMultiple >= 1.5 ? 'text-emerald-600' : kpis.weightedMultiple >= 1 ? 'text-amber-600' : 'text-destructive';
  const equityColor = kpis.totalEquityValue > kpis.totalDrawn ? 'text-emerald-600' : '';
  const canSendPortalAccessEmail = Boolean(investor.portal_access_enabled && investor.email);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/investors')} className="mb-1">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Investors
            </Button>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{investor.investor_name}</h1>
              <Badge variant="outline" className={typeConfig.className}>{typeConfig.label}</Badge>
              {investor.accredited_investor && <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"><Award className="h-3 w-3 mr-1" />Accredited</Badge>}
              {investor.kyc_completed ? (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"><ShieldCheck className="h-3 w-3 mr-1" />KYC Complete</Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">KYC Pending</Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {investor.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{investor.email}</span>}
              {investor.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{investor.phone}</span>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={!canSendPortalAccessEmail || sendPortalAccessEmail.isPending}
              onClick={() => void sendPortalAccessEmail.mutateAsync(investor.id)}
            >
              <Mail className="h-4 w-4 mr-2" />
              Send Portal Access
            </Button>
            <Button variant="outline" onClick={() => setShowReportModal(true)}>
              <FileText className="h-4 w-4 mr-2" />Statement
            </Button>
            <Button variant="outline" onClick={() => setShowEditModal(true)}>
              <Edit className="h-4 w-4 mr-2" />Edit
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-5 gap-4">
          {[
            { label: 'Total Committed', value: fmt(kpis.totalCommitted) },
            { label: 'Total Deployed', value: fmt(kpis.totalDrawn) },
            { label: 'Current Equity Value', value: fmt(kpis.totalEquityValue), className: equityColor },
            { label: 'Total Distributions', value: fmt(kpis.totalDistributed) },
            { label: 'Equity Multiple', value: `${kpis.weightedMultiple.toFixed(2)}x`, className: multipleColor },
          ].map(kpi => (
            <Card key={kpi.label}>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                <p className={`text-2xl font-bold mt-1 ${kpi.className || ''}`}>{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Commitments Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Capital Commitments</CardTitle>
            <Button size="sm" onClick={() => setShowCommitmentModal(true)}>
              <Plus className="h-4 w-4 mr-1" />Add Commitment
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entity</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Committed</TableHead>
                    <TableHead className="text-right">Drawn</TableHead>
                    <TableHead className="text-right">Undrawn</TableHead>
                    <TableHead className="text-right">Equity %</TableHead>
                    <TableHead className="text-right">Share of Value</TableHead>
                    <TableHead className="text-center">Properties</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Maturity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(!commitments || commitments.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No commitments yet</TableCell>
                    </TableRow>
                  ) : commitments.map(c => {
                    const statusConfig = STATUS_BADGE[c.status || 'active'] || STATUS_BADGE.active;
                    return (
                      <TableRow key={c.commitment_id}>
                        <TableCell className="font-semibold">{c.entity_name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {COMMITMENT_TYPE_LABEL[c.commitment_type || ''] || c.commitment_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmt(c.committed_amount)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmt(c.drawn_amount)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmt(c.undrawn_amount)}</TableCell>
                        <TableCell className="text-right">{c.equity_percentage ? `${c.equity_percentage}%` : '-'}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmt(c.investors_share_valuation)}</TableCell>
                        <TableCell className="text-center">{c.property_count || 0}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusConfig.className}>{statusConfig.label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{c.commitment_date ? format(new Date(c.commitment_date), 'dd MMM yyyy') : '-'}</TableCell>
                        <TableCell className="text-sm">{c.maturity_date ? format(new Date(c.maturity_date), 'dd MMM yyyy') : '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Distributions Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Distributions</CardTitle>
              <div className="flex gap-6 mt-2 text-sm text-muted-foreground">
                <span>All-time: <strong className="text-foreground">{fmt(distStats.allTime)}</strong></span>
                <span>This year: <strong className="text-foreground">{fmt(distStats.thisYear)}</strong></span>
                <span>Last year: <strong className="text-foreground">{fmt(distStats.lastYear)}</strong></span>
                <span>Yield: <strong className="text-foreground">{distStats.yield.toFixed(1)}%</strong></span>
              </div>
            </div>
            <Button size="sm" onClick={() => setShowDistributionModal(true)}>
              <Plus className="h-4 w-4 mr-1" />Record Distribution
            </Button>
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
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!distributions || distributions.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No distributions recorded</TableCell>
                  </TableRow>
                ) : distributions.map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="text-sm">{format(new Date(d.distribution_date), 'dd MMM yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{DIST_TYPE_LABEL[d.distribution_type] || d.distribution_type}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(d.amount)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">{fmt(d.tax_deducted)}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">{fmt(d.net_amount)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {d.period_from && d.period_to
                        ? `${format(new Date(d.period_from), 'MMM yy')} - ${format(new Date(d.period_to), 'MMM yy')}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.payment_reference || '-'}</TableCell>
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

        {/* Return Metrics Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Return Metrics</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity</TableHead>
                  <TableHead className="text-right">Capital Invested</TableHead>
                  <TableHead className="text-right">Total Distributions</TableHead>
                  <TableHead className="text-right">Current Equity Value</TableHead>
                  <TableHead className="text-right">Cash-on-Cash %</TableHead>
                  <TableHead className="text-right">Equity Multiple</TableHead>
                  <TableHead className="text-right">Unrealised Gain/Loss</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!returnMetrics || returnMetrics.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No return data available</TableCell>
                  </TableRow>
                ) : returnMetrics.map(m => {
                  const emColor = (m.equity_multiple || 0) >= 1.5 ? 'text-emerald-600' : (m.equity_multiple || 0) >= 1 ? 'text-amber-600' : 'text-destructive';
                  const gainColor = (m.unrealised_gain_loss || 0) >= 0 ? 'text-emerald-600' : 'text-destructive';
                  return (
                    <TableRow key={m.commitment_id}>
                      <TableCell className="font-semibold">{m.entity_name}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmt(m.capital_invested)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmt(m.total_distributions)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmt(m.current_equity_value)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{(m.cash_on_cash_pct || 0).toFixed(1)}%</TableCell>
                      <TableCell className={`text-right font-mono text-sm font-semibold ${emColor}`}>
                        {(m.equity_multiple || 0).toFixed(2)}x
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm font-semibold ${gainColor}`}>
                        {fmt(m.unrealised_gain_loss)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Report History */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Report History</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowReportModal(true)}>
              <FileText className="h-4 w-4 mr-1" />Generate Statement
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!reports || reports.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No reports generated yet</TableCell>
                  </TableRow>
                ) : reports.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(r.report_period_from), 'MMM yyyy')} - {format(new Date(r.report_period_to), 'MMM yyyy')}
                    </TableCell>
                    <TableCell className="text-sm">{r.generated_at ? format(new Date(r.generated_at), 'dd MMM yyyy') : '-'}</TableCell>
                    <TableCell>
                      {r.sent_to_investor ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Sent</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Not sent</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.file_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={downloadingInvestorReport}
                          onClick={() => void downloadInvestorReport(r.file_url!, r.file_name || r.title)}
                        >
                            <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <InvestorFormModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        investor={investor}
      />
      <CommitmentFormModal
        open={showCommitmentModal}
        onOpenChange={setShowCommitmentModal}
        investorId={id!}
      />
      <DistributionFormModal
        open={showDistributionModal}
        onOpenChange={setShowDistributionModal}
        investorId={id!}
        commitments={commitmentOptions}
      />
      {investor && (
        <InvestorReportModal
          open={showReportModal}
          onOpenChange={setShowReportModal}
          investor={investor}
          commitments={commitments || []}
          distributions={distributions || []}
          returnMetrics={returnMetrics || []}
        />
      )}
    </AppLayout>
  );
}
