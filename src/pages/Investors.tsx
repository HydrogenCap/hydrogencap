import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Check, Minus } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

import { ListState } from '@/components/ListState';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ResponsiveTable, ColumnConfig } from '@/components/common';
import { useInvestors, useInvestorPortfolioSummaries, Investor } from '@/hooks/useInvestors';
import { InvestorFormModal } from '@/components/investors/InvestorFormModal';
import { SEO } from '@/components/SEO';

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  individual: { label: 'Individual', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  company: { label: 'Company', className: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' },
  trust: { label: 'Trust', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  family_office: { label: 'Family Office', className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
  fund: { label: 'Fund', className: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' },
  jv_partner: { label: 'JV Partner', className: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20' },
};

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `£${(amount / 1_000_000).toFixed(2)}m`;
  if (amount >= 1_000) return `£${(amount / 1_000).toFixed(0)}k`;
  return `£${amount.toLocaleString()}`;
}

function formatAmount(amount: number): string {
  return `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function Investors() {
  const { data: investors, isLoading, error, refetch } = useInvestors();
  const { data: summaries } = useInvestorPortfolioSummaries();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [portalFilter, setPortalFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [showModal, setShowModal] = useState(false);
  const [editingInvestor, setEditingInvestor] = useState<Investor | null>(null);

  const summaryMap = useMemo(() => {
    const map: Record<string, typeof summaries extends (infer T)[] | undefined ? T : never> = {};
    summaries?.forEach(s => { map[s.investor_id] = s; });
    return map;
  }, [summaries]);

  // Aggregate stats
  const stats = useMemo(() => {
    if (!summaries) return { count: 0, committed: 0, deployed: 0, distributed: 0 };
    return {
      count: summaries.length,
      committed: summaries.reduce((s, i) => s + (i.total_committed || 0), 0),
      deployed: summaries.reduce((s, i) => s + (i.total_drawn || 0), 0),
      distributed: summaries.reduce((s, i) => s + (i.total_distributed || 0), 0),
    };
  }, [summaries]);

  const filtered = useMemo(() => {
    if (!investors) return [];
    const result = investors.filter(i => {
      if (search && !i.investor_name.toLowerCase().includes(search.toLowerCase()) &&
          !(i.email && i.email.toLowerCase().includes(search.toLowerCase()))) return false;
      if (typeFilter !== 'all' && i.investor_type !== typeFilter) return false;
      if (portalFilter === 'enabled' && !i.portal_access_enabled) return false;
      if (portalFilter === 'disabled' && i.portal_access_enabled) return false;
      return true;
    });
    result.sort((a, b) => {
      const sa = summaryMap[a.id];
      const sb = summaryMap[b.id];
      if (sortBy === 'committed') return (sb?.total_committed || 0) - (sa?.total_committed || 0);
      if (sortBy === 'distributed') return (sb?.total_distributed || 0) - (sa?.total_distributed || 0);
      return a.investor_name.localeCompare(b.investor_name);
    });
    return result;
  }, [investors, search, typeFilter, portalFilter, sortBy, summaryMap]);

  const handleEdit = (investor: Investor, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingInvestor(investor);
    setShowModal(true);
  };

  const statCards = [
    { label: 'Total Investors', value: stats.count.toString() },
    { label: 'Capital Committed', value: formatCurrency(stats.committed) },
    { label: 'Capital Deployed', value: formatCurrency(stats.deployed) },
    { label: 'Total Distributed', value: formatAmount(stats.distributed) },
  ];

  return (
    <AppLayout>
      <SEO title="Investors — TenureIQ" description="Manage investor stakes, distributions, and portal access in one register." />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Investors</h1>
            <p className="text-muted-foreground">Manage investors and track capital commitments</p>
          </div>
          <Button onClick={() => { setEditingInvestor(null); setShowModal(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Investor
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4">
          {statCards.map(s => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
                <p className="text-2xl font-bold mt-1">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input aria-label="Search investors" placeholder="Search investors..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(TYPE_BADGE).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={portalFilter} onValueChange={setPortalFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Portal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Access</SelectItem>
              <SelectItem value="enabled">Portal Enabled</SelectItem>
              <SelectItem value="disabled">Portal Disabled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Sort: Name</SelectItem>
              <SelectItem value="committed">Sort: Committed</SelectItem>
              <SelectItem value="distributed">Sort: Distributed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <ListState
          isLoading={isLoading}
          error={error as Error | null}
          isEmpty={!investors || investors.length === 0}
          emptyIcon={Plus}
          emptyTitle="No investors yet"
          emptyDescription='Click "Add Investor" to get started.'
          emptyAction={{ label: 'Add Investor', onClick: () => setShowModal(true) }}
          onRetry={() => refetch()}
        >
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              No investors match your filters.
            </div>
          ) : (
            <div className="border rounded-lg p-2">
              <ResponsiveTable
                data={filtered}
                keyExtractor={(i) => i.id}
                onRowClick={(i) => navigate(`/investors/${i.id}`)}
                columns={[
                  {
                    key: 'name',
                    header: 'Investor Name',
                    render: (i) => <span className="font-semibold">{i.investor_name}</span>,
                  },
                  {
                    key: 'type',
                    header: 'Type',
                    hideOnMobile: true,
                    render: (i) => {
                      const cfg = TYPE_BADGE[i.investor_type] || TYPE_BADGE.individual;
                      return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
                    },
                  },
                  {
                    key: 'entities',
                    header: 'Entities',
                    hideOnMobile: true,
                    render: (i) => summaryMap[i.id]?.entities_invested || 0,
                  },
                  {
                    key: 'committed',
                    header: 'Total Committed',
                    render: (i) => (
                      <span className="font-mono text-sm">
                        {formatAmount(summaryMap[i.id]?.total_committed || 0)}
                      </span>
                    ),
                  },
                  {
                    key: 'drawn',
                    header: 'Total Drawn',
                    hideOnMobile: true,
                    render: (i) => (
                      <span className="font-mono text-sm">
                        {formatAmount(summaryMap[i.id]?.total_drawn || 0)}
                      </span>
                    ),
                  },
                  {
                    key: 'distributed',
                    header: 'Total Distributed',
                    hideOnMobile: true,
                    render: (i) => (
                      <span className="font-mono text-sm">
                        {formatAmount(summaryMap[i.id]?.total_distributed || 0)}
                      </span>
                    ),
                  },
                  {
                    key: 'multiple',
                    header: 'Multiple',
                    render: (i) => {
                      const m = summaryMap[i.id]?.distribution_multiple || 0;
                      const color = m >= 1 ? 'text-emerald-600' : m >= 0.5 ? 'text-amber-600' : 'text-destructive';
                      return <span className={`font-mono text-sm font-semibold ${color}`}>{m.toFixed(2)}x</span>;
                    },
                  },
                  {
                    key: 'portal',
                    header: 'Portal',
                    hideOnMobile: true,
                    render: (i) => i.portal_access_enabled
                      ? <Check className="h-4 w-4 text-emerald-600" />
                      : <Minus className="h-4 w-4 text-muted-foreground" />,
                  },
                  {
                    key: 'actions',
                    header: 'Actions',
                    render: (i) => (
                      <Button variant="ghost" size="sm" onClick={(e) => handleEdit(i, e)}>
                        Edit
                      </Button>
                    ),
                  },
                ] satisfies ColumnConfig<Investor>[]}
              />
            </div>
          )}
        </ListState>
      </div>

      <InvestorFormModal
        open={showModal}
        onOpenChange={(open) => { setShowModal(open); if (!open) setEditingInvestor(null); }}
        investor={editingInvestor}
      />
    </AppLayout>
  );
}
