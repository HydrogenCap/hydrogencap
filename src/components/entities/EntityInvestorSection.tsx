import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useEntityCommitments, useEntityDistributions } from '@/hooks/useEntityInvestorData';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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

function fmt(amount: number | null | undefined): string {
  return `£${(amount || 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

interface Props {
  entityId: string;
}

export function EntityInvestorSection({ entityId }: Props) {
  const navigate = useNavigate();
  const { data: commitments, isLoading: commitmentsLoading } = useEntityCommitments(entityId);
  const { data: distributions, isLoading: distributionsLoading } = useEntityDistributions(entityId);

  const stats = useMemo(() => {
    const totalCommitted = commitments?.reduce((s, c) => s + (c.committed_amount || 0), 0) || 0;
    const totalDrawn = commitments?.reduce((s, c) => s + (c.drawn_amount || 0), 0) || 0;
    const totalDistributed = distributions?.filter(d => d.status === 'paid').reduce((s, d) => s + (d.amount || 0), 0) || 0;
    const investorCount = new Set(commitments?.map(c => c.investor_id).filter(Boolean)).size;
    return { totalCommitted, totalDrawn, totalDistributed, investorCount };
  }, [commitments, distributions]);

  if (commitmentsLoading || distributionsLoading) return <Skeleton className="h-48" />;

  // Don't show the section if there are no investor commitments
  if (!commitments || commitments.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Investor Capital</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Investors</span>
            <span className="text-lg font-bold text-foreground">{stats.investorCount}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Total Committed</span>
            <span className="text-lg font-bold text-foreground">{fmt(stats.totalCommitted)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Capital Deployed</span>
            <span className="text-lg font-bold text-foreground">{fmt(stats.totalDrawn)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Total Distributed</span>
            <span className={cn('text-lg font-bold', stats.totalDistributed > 0 ? 'text-emerald-600' : 'text-foreground')}>
              {fmt(stats.totalDistributed)}
            </span>
          </div>
        </div>

        {/* Commitments table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Investor</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Committed</TableHead>
                <TableHead className="text-right">Drawn</TableHead>
                <TableHead className="text-right">Equity %</TableHead>
                <TableHead className="text-right">Share of Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commitments.map(c => {
                const statusConfig = STATUS_BADGE[c.status || 'active'] || STATUS_BADGE.active;
                return (
                  <TableRow
                    key={c.commitment_id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/investors/${c.investor_id}`)}
                  >
                    <TableCell className="font-semibold">{c.investor_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {COMMITMENT_TYPE_LABEL[c.commitment_type || ''] || c.commitment_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(c.committed_amount)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(c.drawn_amount)}</TableCell>
                    <TableCell className="text-right">{c.equity_percentage ? `${c.equity_percentage}%` : '—'}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(c.investors_share_valuation)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusConfig.className}>{statusConfig.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.commitment_date ? format(new Date(c.commitment_date), 'dd MMM yyyy') : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
