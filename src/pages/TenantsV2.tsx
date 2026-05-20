import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Search, AlertTriangle, Check, Clock, CalendarClock } from 'lucide-react';
import { format } from 'date-fns';
import { useTenancyEvents } from '@/hooks/useTenancyEvents';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, SavedViewsMenu } from '@/components/common';
import { ListState } from '@/components/ListState';
import { useTenantsV2WithTenancy, TENANT_TYPES, TENANT_STATUSES } from '@/hooks/useTenantsV2';
import { useTenancyComplianceChecks } from '@/hooks/useTenancyAgreements';
import { AddTenantModal } from '@/components/tenants-v2/AddTenantModal';
import { SEO } from '@/components/SEO';

const STATUS_BG: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700', prospective: 'bg-blue-100 text-blue-700',
  in_notice: 'bg-amber-100 text-amber-700', departed: 'bg-muted text-muted-foreground',
  evicted: 'bg-red-100 text-red-700', archived: 'bg-muted/50 text-muted-foreground',
};

const TYPE_BG: Record<string, string> = {
  private: 'bg-blue-100 text-blue-700', dss_hb: 'bg-purple-100 text-purple-700',
  uc: 'bg-purple-100 text-purple-700', council_placement: 'bg-indigo-100 text-indigo-700',
  supported_housing: 'bg-teal-100 text-teal-700',
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  try { return format(new Date(d), 'dd/MM/yyyy'); } catch { return '—'; }
}
function fmtRent(v: number | null | undefined) {
  if (v == null) return '—';
  return `£${v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function getLabel(arr: readonly { value: string; label: string }[], v: string) {
  return arr.find(x => x.value === v)?.label || v;
}

export default function TenantsV2() {
  const navigate = useNavigate();
  const { data: tenants, isLoading, error, refetch } = useTenantsV2WithTenancy();
  const { data: compliance } = useTenancyComplianceChecks();
  const { data: tenancyEvents } = useTenancyEvents({ daysAhead: 30 });
  const urgentEvents = useMemo(() =>
    (tenancyEvents || []).filter(e => e.status === 'overdue' || e.status === 'action_required'),
    [tenancyEvents]
  );
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState('name_asc');
  const [showAdd, setShowAdd] = useState(false);

  const complianceMap = useMemo(() => {
    const m = new Map<string, typeof compliance extends (infer U)[] ? U : never>();
    (compliance || []).forEach(c => m.set(c.tenant_id, c));
    return m;
  }, [compliance]);

  const filtered = useMemo(() => {
    let list = tenants || [];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        `${t.first_name} ${t.last_name}`.toLowerCase().includes(q) ||
        t.email?.toLowerCase().includes(q) ||
        t.phone?.includes(q)
      );
    }
    if (statusFilter !== 'all') list = list.filter(t => t.status === statusFilter);
    if (typeFilter !== 'all') list = list.filter(t => t.tenant_type === typeFilter);

    const sorted = [...list];
    switch (sortBy) {
      case 'name_asc': sorted.sort((a, b) => `${a.last_name}${a.first_name}`.localeCompare(`${b.last_name}${b.first_name}`)); break;
      case 'name_desc': sorted.sort((a, b) => `${b.last_name}${b.first_name}`.localeCompare(`${a.last_name}${a.first_name}`)); break;
      case 'newest': sorted.sort((a, b) => b.created_at.localeCompare(a.created_at)); break;
      case 'rent_high': sorted.sort((a, b) => (b.current_tenancy?.rent_amount_pcm || 0) - (a.current_tenancy?.rent_amount_pcm || 0)); break;
      case 'rent_low': sorted.sort((a, b) => (a.current_tenancy?.rent_amount_pcm || 0) - (b.current_tenancy?.rent_amount_pcm || 0)); break;
    }
    return sorted;
  }, [tenants, search, statusFilter, typeFilter, sortBy]);

  // Stats
  const activeCount = tenants?.filter(t => t.status === 'active').length || 0;
  const noticeCount = tenants?.filter(t => t.status === 'in_notice').length || 0;
  const avgRent = useMemo(() => {
    const rents = (tenants || []).map(t => t.current_tenancy?.rent_amount_pcm).filter((r): r is number => r != null);
    return rents.length > 0 ? rents.reduce((a, b) => a + b, 0) / rents.length : 0;
  }, [tenants]);
  const depositIssues = useMemo(() => {
    return (compliance || []).filter(c => c.deposit_compliance !== 'compliant' && c.deposit_compliance !== 'no_deposit').length;
  }, [compliance]);

  return (
    <AppLayout>
      <SEO title="Tenants — TenureIQ" description="Know your tenants before issues arise — agreements, payment scores, and notices." />
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-6 w-6" /> Tenants
            </h1>
            <p className="text-muted-foreground text-sm">Manage tenants and tenancy agreements</p>
          </div>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Tenant
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4 pb-3"><p className="text-sm text-muted-foreground">Active Tenants</p><p className="text-xl md:text-2xl font-bold">{activeCount}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-3"><p className="text-sm text-muted-foreground">In Notice</p><p className={`text-xl md:text-2xl font-bold ${noticeCount > 0 ? 'text-amber-600' : ''}`}>{noticeCount}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-3"><p className="text-sm text-muted-foreground">Average Rent</p><p className="text-xl md:text-2xl font-bold">{fmtRent(avgRent)}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-3"><p className="text-sm text-muted-foreground">Deposit Issues</p><p className={`text-xl md:text-2xl font-bold ${depositIssues > 0 ? 'text-destructive' : ''}`}>{depositIssues}</p></CardContent></Card>
        </div>

        {/* Urgent Events Banner */}
        {urgentEvents.length > 0 && (
          <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
            <CalendarClock className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1.5">
                <p className="font-semibold text-sm">
                  {urgentEvents.length} tenancy event{urgentEvents.length !== 1 ? 's' : ''} requiring attention
                </p>
                {urgentEvents.map(ev => (
                  <div
                    key={`${ev.tenancyId}-${ev.type}`}
                    className="flex items-start gap-2 text-sm cursor-pointer hover:underline"
                    onClick={() => navigate(`/tenants-v2/${ev.tenancyId}`)}
                  >
                    <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>
                      <strong>{ev.title}</strong> — {ev.propertyAddress}
                      {ev.tenantName !== 'Unknown' && ` (${ev.tenantName})`}
                      {' · '}
                      <span className={ev.status === 'overdue' ? 'text-destructive font-medium' : ''}>
                        {ev.description}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 md:gap-3">
          <div className="relative w-full md:flex-1 md:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input aria-label="Search tenants by name, email or phone" placeholder="Search by name, email, phone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {TENANT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {TENANT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name_asc">Name A-Z</SelectItem>
              <SelectItem value="name_desc">Name Z-A</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="rent_high">Rent ↑</SelectItem>
              <SelectItem value="rent_low">Rent ↓</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <ListState
          isLoading={isLoading}
          error={error as Error | null}
          isEmpty={!tenants || tenants.length === 0}
          emptyIcon={Users}
          emptyTitle="No tenants yet"
          emptyDescription="Add tenants to track tenancies, rent payments, and communications."
          emptyAction={{ label: 'Add Tenant', onClick: () => setShowAdd(true) }}
          onRetry={() => refetch()}
        >
          {filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No tenants match your filters"
              description="Try adjusting your search or filter criteria."
            />
          ) : (
            <div className="border rounded-lg overflow-x-auto -mx-4 md:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead className="text-right">Rent PCM</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead className="w-10">Deposit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(t => {
                      const c = complianceMap.get(t.id);
                      const depositOk = !c || c.deposit_compliance === 'compliant' || c.deposit_compliance === 'no_deposit';
                      return (
                        <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/tenants-v2/${t.id}`)}>
                          <TableCell className="font-medium">{t.last_name}, {t.first_name}</TableCell>
                          <TableCell><Badge className={STATUS_BG[t.status]}>{getLabel(TENANT_STATUSES, t.status)}</Badge></TableCell>
                          <TableCell><Badge className={TYPE_BG[t.tenant_type]}>{getLabel(TENANT_TYPES, t.tenant_type)}</Badge></TableCell>
                          <TableCell className="text-sm">{t.current_tenancy?.property_address || '—'}</TableCell>
                          <TableCell className="text-sm">{t.current_tenancy?.room_name || '—'}</TableCell>
                          <TableCell className="text-right font-medium">{fmtRent(t.current_tenancy?.rent_amount_pcm)}</TableCell>
                          <TableCell className="text-sm">{fmtDate(t.current_tenancy?.start_date ?? null)}</TableCell>
                          <TableCell>
                            {c ? (
                              depositOk ? (
                                <Check className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger><AlertTriangle className="h-4 w-4 text-destructive" /></TooltipTrigger>
                                  <TooltipContent>{c.deposit_compliance.replace(/_/g, ' ')}</TooltipContent>
                                </Tooltip>
                              )
                            ) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          )}
        </ListState>
      </div>

      <AddTenantModal open={showAdd} onOpenChange={setShowAdd} onSuccess={id => navigate(`/tenants-v2/${id}`)} />
    </AppLayout>
  );
}
