import { useState, useMemo, useEffect, useRef, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Building2, User, Handshake, Shield,
  CheckCircle, AlertTriangle, RefreshCw, Loader2,
  AlertCircle as AlertCircleIcon, CheckCircle2, Download, Archive,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { ResponsiveTable, type ColumnConfig } from '@/components/common';
import { BulkActionBar } from '@/components/common/BulkActionBar';
import { useLegalEntities, useUpdateLegalEntity, type LegalEntity } from '@/hooks/useLegalEntities';
import { useEntityVerificationStatus, useSyncEntity, type EntityVerification } from '@/hooks/useCompaniesHouseV2';
import { usePropertiesV2 } from '@/hooks/usePropertiesV2';
import { useAllLoanFacilities } from '@/hooks/useLoanFacilities';
import { usePropertyRoomSummaries } from '@/hooks/useRoomsV2';
import { getComplianceStatus } from '@/lib/complianceStatus';
import { EntityFormModal } from '@/components/entities/EntityFormModal';
import { EntitiesKPIStrip } from '@/components/entities/EntitiesKPIStrip';
import { EntitiesFilterChips, type EntityFilterKey } from '@/components/entities/EntitiesFilterChips';
import { SEO } from '@/components/SEO';
import { toast } from "sonner";

const FILTER_STORAGE_KEY = 'entities_filter_chip';

const TYPE_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline'; icon: ComponentType<{ className?: string }> }> = {
  spv: { label: 'SPV', variant: 'default', icon: Building2 },
  ltd_company: { label: 'Ltd Company', variant: 'default', icon: Building2 },
  personal: { label: 'Personal', variant: 'secondary', icon: User },
  joint_venture: { label: 'Joint Venture', variant: 'outline', icon: Handshake },
  trust: { label: 'Trust', variant: 'outline', icon: Shield },
};
const DEFAULT_TYPE_CONFIG = { label: 'Entity', variant: 'outline' as const, icon: Building2 };

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  dormant: { label: 'Dormant', className: 'bg-muted text-muted-foreground border-border' },
  dissolved: { label: 'Dissolved', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};
const DEFAULT_STATUS_CONFIG = { label: 'Unknown', className: 'bg-muted text-muted-foreground border-border' };

const STALE_MS = 24 * 60 * 60 * 1000;
const _DUE_SOON_MS = 30 * 24 * 60 * 60 * 1000;

function formatGBP(value: number | null | undefined) {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}
function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(1)}%`;
}
function relativeTime(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function ComplianceStatusIndicator({ dueDate }: { dueDate: string }) {
  const status = getComplianceStatus(dueDate);
  const icons = {
    overdue: <AlertCircleIcon className="h-3.5 w-3.5 text-destructive" />,
    due_soon: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,
    ok: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
    unknown: null,
  };
  return (
    <span className="flex items-center gap-1.5 text-xs">
      {icons[status.status]}
      <span className={status.status === 'overdue' ? 'text-destructive font-medium' : 'text-muted-foreground'}>
        {status.label}
      </span>
    </span>
  );
}

interface EntityMetrics {
  propertyCount: number;
  totalValue: number;
  totalDebt: number;
  monthlyRent: number;
  ltv: number | null;
}

interface Row extends LegalEntity {
  metrics: EntityMetrics;
  verification: EntityVerification | undefined;
  needsAttention: boolean;
  isStale: boolean;
}

function csvEscape(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Entities() {
  const { data: entities, isLoading } = useLegalEntities();
  const { data: verifications } = useEntityVerificationStatus();
  const { data: allPropertiesV2 } = usePropertiesV2();
  const { data: loans } = useAllLoanFacilities();
  const { data: roomSummaries } = usePropertyRoomSummaries();
  const syncEntity = useSyncEntity();
  const updateEntity = useUpdateLegalEntity();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [filterChip, setFilterChip] = useState<EntityFilterKey>(() => {
    if (typeof window === 'undefined') return 'all';
    return (localStorage.getItem(FILTER_STORAGE_KEY) as EntityFilterKey) || 'all';
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    localStorage.setItem(FILTER_STORAGE_KEY, filterChip);
  }, [filterChip]);

  const verificationMap = useMemo(() => {
    const map: Record<string, EntityVerification> = {};
    verifications?.forEach((v) => { map[v.entity_id] = v; });
    return map;
  }, [verifications]);

  const entityMetricsMap = useMemo(() => {
    const map = new Map<string, EntityMetrics>();
    const propertyIdToEntity = new Map<string, string>();
    allPropertiesV2?.forEach((p) => {
      propertyIdToEntity.set(p.id, p.entity_id);
      const cur = map.get(p.entity_id) || { propertyCount: 0, totalValue: 0, totalDebt: 0, monthlyRent: 0, ltv: null };
      const rent = p.rent_basis === 'whole_house' ? (p.whole_house_rent_pcm || 0) : (roomSummaries?.get(p.id)?.gross_rent_pcm || 0);
      map.set(p.entity_id, {
        ...cur,
        propertyCount: cur.propertyCount + 1,
        totalValue: cur.totalValue + (p.current_valuation || 0),
        monthlyRent: cur.monthlyRent + rent,
      });
    });
    loans?.forEach((loan) => {
      if (!['active', 'drawdown', 'pending_drawdown'].includes(loan.status)) return;
      const eid = propertyIdToEntity.get(loan.property_id) || loan.entity_id;
      const cur = map.get(eid) || { propertyCount: 0, totalValue: 0, totalDebt: 0, monthlyRent: 0, ltv: null };
      map.set(eid, { ...cur, totalDebt: cur.totalDebt + (loan.current_balance || 0) });
    });
    map.forEach((m, id) => {
      map.set(id, { ...m, ltv: m.totalValue > 0 ? (m.totalDebt / m.totalValue) * 100 : null });
    });
    return map;
  }, [allPropertiesV2, loans, roomSummaries]);

  const enrichedRows: Row[] = useMemo(() => {
    if (!entities) return [];
    const now = Date.now();
    return entities.map((e) => {
      const v = verificationMap[e.id];
      const metrics = entityMetricsMap.get(e.id) || { propertyCount: 0, totalValue: 0, totalDebt: 0, monthlyRent: 0, ltv: null };
      const accountsOverdue = v?.ch_accounts_next_due ? getComplianceStatus(v.ch_accounts_next_due).status === 'overdue' : false;
      const accountsSoon = v?.ch_accounts_next_due ? getComplianceStatus(v.ch_accounts_next_due).status === 'due_soon' : false;
      const confOverdue = v?.ch_confirmation_next_due ? getComplianceStatus(v.ch_confirmation_next_due).status === 'overdue' : false;
      const confSoon = v?.ch_confirmation_next_due ? getComplianceStatus(v.ch_confirmation_next_due).status === 'due_soon' : false;
      const needsAttention = accountsOverdue || accountsSoon || confOverdue || confSoon;
      const isStale = (e.entity_type === 'spv') && !!e.company_number && (!v?.last_synced || now - new Date(v.last_synced).getTime() > STALE_MS);
      return { ...e, metrics, verification: v, needsAttention, isStale };
    });
  }, [entities, verificationMap, entityMetricsMap]);

  const totals = useMemo(() => {
    const breakdown = { spv: 0, personal: 0, jv: 0, trust: 0 };
    let totalValue = 0;
    let totalDebt = 0;
    let attention = 0;
    enrichedRows.forEach((r) => {
      if (r.entity_type === 'spv') breakdown.spv++;
      else if (r.entity_type === 'personal') breakdown.personal++;
      else if (r.entity_type === 'joint_venture') breakdown.jv++;
      else if (r.entity_type === 'trust') breakdown.trust++;
      totalValue += r.metrics.totalValue;
      totalDebt += r.metrics.totalDebt;
      if (r.needsAttention) attention++;
    });
    return {
      total: enrichedRows.length,
      breakdown,
      totalValue,
      totalDebt,
      blendedLTV: totalValue > 0 ? (totalDebt / totalValue) * 100 : null,
      attention,
    };
  }, [enrichedRows]);

  const chipCounts: Partial<Record<EntityFilterKey, number>> = useMemo(() => {
    const c: Partial<Record<EntityFilterKey, number>> = { all: enrichedRows.length };
    let spv = 0, personal = 0, jvt = 0, gp = 0, stale = 0, fo = 0, fs = 0, dormant = 0;
    enrichedRows.forEach((r) => {
      if (r.entity_type === 'spv') spv++;
      if (r.entity_type === 'personal') personal++;
      if (r.entity_type === 'joint_venture' || r.entity_type === 'trust') jvt++;
      if (r.is_group_parent) gp++;
      if (r.isStale) stale++;
      const v = r.verification;
      if (v?.ch_accounts_next_due && getComplianceStatus(v.ch_accounts_next_due).status === 'overdue') fo++;
      else if (v?.ch_confirmation_next_due && getComplianceStatus(v.ch_confirmation_next_due).status === 'overdue') fo++;
      if (v?.ch_accounts_next_due && getComplianceStatus(v.ch_accounts_next_due).status === 'due_soon') fs++;
      else if (v?.ch_confirmation_next_due && getComplianceStatus(v.ch_confirmation_next_due).status === 'due_soon') fs++;
      if (r.status === 'dormant') dormant++;
    });
    return { ...c, spv, personal, jv_trust: jvt, group_parent: gp, stale_sync: stale, filings_overdue: fo, filings_due_soon: fs, dormant };
  }, [enrichedRows]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return enrichedRows.filter((r) => {
      const matchesSearch =
        r.entity_name.toLowerCase().includes(s) ||
        (r.company_number && r.company_number.toLowerCase().includes(s));
      if (!matchesSearch) return false;
      switch (filterChip) {
        case 'all': return true;
        case 'spv': return r.entity_type === 'spv';
        case 'personal': return r.entity_type === 'personal';
        case 'jv_trust': return r.entity_type === 'joint_venture' || r.entity_type === 'trust';
        case 'group_parent': return !!r.is_group_parent;
        case 'stale_sync': return r.isStale;
        case 'filings_overdue': {
          const v = r.verification;
          return (v?.ch_accounts_next_due && getComplianceStatus(v.ch_accounts_next_due).status === 'overdue') ||
                 (v?.ch_confirmation_next_due && getComplianceStatus(v.ch_confirmation_next_due).status === 'overdue');
        }
        case 'filings_due_soon': {
          const v = r.verification;
          return (v?.ch_accounts_next_due && getComplianceStatus(v.ch_accounts_next_due).status === 'due_soon') ||
                 (v?.ch_confirmation_next_due && getComplianceStatus(v.ch_confirmation_next_due).status === 'due_soon');
        }
        case 'dormant': return r.status === 'dormant';
        default: return true;
      }
    });
  }, [enrichedRows, search, filterChip]);

  const handleBulkSync = async () => {
    const spvs = entities?.filter((e) => e.entity_type === 'spv' && e.company_number) || [];
    if (spvs.length === 0) { toast('No SPVs with company numbers to sync'); return; }
    setBulkSyncing(true);
    let synced = 0;
    for (const spv of spvs) {
      try {
        await syncEntity.mutateAsync({ entityId: spv.id, companyNumber: spv.company_number! });
        synced++;
      } catch (err) { console.error('Failed to sync entity:', err); }
      await new Promise((r) => setTimeout(r, 500));
    }
    setBulkSyncing(false);
    toast.success(`Synced ${synced} of ${spvs.length} SPVs`);
  };

  const handleRowSync = async (entity: LegalEntity) => {
    if (!entity.company_number) return;
    setSyncingIds((prev) => new Set(prev).add(entity.id));
    try {
      await syncEntity.mutateAsync({ entityId: entity.id, companyNumber: entity.company_number });
      toast.success(`${entity.entity_name} synced`);
    } catch (err) {
      console.error(err);
      toast.error('Sync failed');
    } finally {
      setSyncingIds((prev) => { const n = new Set(prev); n.delete(entity.id); return n; });
    }
  };

  const handleExportCSV = (rows: Row[]) => {
    const header = ['Entity Name','Company Number','Type','Status','Properties','Value (GBP)','Debt (GBP)','LTV (%)','Monthly Rent (GBP)','CH Status','Accounts Due','Confirmation Due','Last Synced'];
    const body = rows.map((r) => [
      r.entity_name,
      r.company_number || '',
      r.entity_type,
      r.status,
      r.metrics.propertyCount,
      Math.round(r.metrics.totalValue),
      Math.round(r.metrics.totalDebt),
      r.metrics.ltv != null ? r.metrics.ltv.toFixed(1) : '',
      Math.round(r.metrics.monthlyRent),
      r.verification?.verification_status || 'not_synced',
      r.verification?.ch_accounts_next_due || '',
      r.verification?.ch_confirmation_next_due || '',
      r.verification?.last_synced || '',
    ].map(String));
    downloadCSV(`entities-${new Date().toISOString().slice(0,10)}.csv`, [header, ...body]);
    toast.success(`Exported ${rows.length} entities`);
  };

  const handleBulkSyncSelected = async () => {
    const targets = filtered.filter((r) => selected.has(r.id) && r.company_number);
    if (targets.length === 0) { toast('No syncable entities in selection'); return; }
    setBulkSyncing(true);
    let n = 0;
    for (const t of targets) {
      try {
        await syncEntity.mutateAsync({ entityId: t.id, companyNumber: t.company_number! });
        n++;
      } catch (err) { console.error(err); }
      await new Promise((r) => setTimeout(r, 500));
    }
    setBulkSyncing(false);
    toast.success(`Synced ${n} of ${targets.length} selected`);
  };

  const handleBulkMarkDormant = async () => {
    const targets = filtered.filter((r) => selected.has(r.id) && r.status !== 'dormant');
    if (targets.length === 0) { toast('Nothing to update'); return; }
    let n = 0;
    for (const t of targets) {
      try {
        await updateEntity.mutateAsync({ id: t.id, status: 'dormant' });
        n++;
      } catch (err) { console.error(err); }
    }
    toast(`Marked ${n} entities as dormant`);
    setSelected(new Set());
  };

  // Auto-sync stale SPVs once per page mount. The in-memory ref prevents
  // duplicate runs; the >24h `last_synced` check already prevents redundant
  // CH API calls, so no sessionStorage lockout is needed.
  const autoSyncedRef = useRef(false);
  useEffect(() => {
    if (autoSyncedRef.current) return;
    if (!entities || !verifications) return;
    const now = Date.now();
    const vByE = new Map(verifications.map((v) => [v.entity_id, v]));
    const stale = entities.filter((e) => {
      if (e.entity_type !== 'spv' || !e.company_number) return false;
      const v = vByE.get(e.id);
      return !v?.last_synced || now - new Date(v.last_synced).getTime() > STALE_MS;
    });
    autoSyncedRef.current = true;
    if (stale.length === 0) return;
    (async () => {
      let failures = 0;
      for (const e of stale) {
        try { await syncEntity.mutateAsync({ entityId: e.id, companyNumber: e.company_number! }); }
        catch (err) { failures++; console.error('Auto-sync failed', e.id, err); }
        await new Promise((r) => setTimeout(r, 600));
      }
      if (failures > 0) {
        toast.error(`${failures} of ${stale.length} entity syncs failed`, { description: 'Companies House refresh failed for some entities. Try a manual sync to see the error.' });
      }
    })();
  }, [entities, verifications, syncEntity]);


  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.id)));
  };

  const columns: ColumnConfig<Row>[] = [
    {
      key: 'select',
      header: '',
      render: (r) => (
        <Checkbox
          checked={selected.has(r.id)}
          onCheckedChange={() => toggleRow(r.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${r.entity_name}`}
        />
      ),
      hideOnMobile: true,
    },
    {
      key: 'name',
      header: 'Entity Name',
      render: (r) => (
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold">{r.entity_name}</p>
            {r.is_group_parent && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                Group
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-mono">{r.company_number || 'No company number'}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (r) => {
        const cfg = TYPE_CONFIG[r.entity_type] || DEFAULT_TYPE_CONFIG;
        const Icon = cfg.icon;
        return (
          <Badge variant={cfg.variant} className="gap-1">
            <Icon className="h-3 w-3" />
            {cfg.label}
          </Badge>
        );
      },
    },
    { key: 'properties', header: 'Properties', render: (r) => <span className="text-muted-foreground">{r.metrics.propertyCount}</span>, hideOnMobile: true },
    { key: 'value', header: 'Value', render: (r) => <span className="font-medium">{formatGBP(r.metrics.totalValue)}</span> },
    { key: 'debt', header: 'Debt', render: (r) => formatGBP(r.metrics.totalDebt), hideOnMobile: true },
    { key: 'ltv', header: 'LTV', render: (r) => formatPercent(r.metrics.ltv) },
    { key: 'rent', header: 'Rent/mo', render: (r) => formatGBP(r.metrics.monthlyRent), hideOnMobile: true },
    {
      key: 'status',
      header: 'Status',
      render: (r) => {
        const cfg = STATUS_CONFIG[r.status] || DEFAULT_STATUS_CONFIG;
        return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
      },
      hideOnMobile: true,
    },
    {
      key: 'ch',
      header: 'CH Sync',
      render: (r) => {
        if (r.entity_type !== 'spv') return <span className="text-muted-foreground text-xs">N/A</span>;
        const v = r.verification;
        const isSyncing = syncingIds.has(r.id);
        const status = v?.verification_status || 'not_synced';
        const statusEl =
          isSyncing ? (
            <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Syncing…</span>
          ) : status === 'verified' ? (
            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-xs"><CheckCircle className="h-3.5 w-3.5" />Verified</span>
          ) : status === 'not_synced' ? (
            <Badge variant="secondary" className="text-xs">Not synced</Badge>
          ) : (
            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 text-xs"><AlertTriangle className="h-3.5 w-3.5" />Mismatch</span>
          );
        return (
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              {statusEl}
              <span className="text-[10px] text-muted-foreground">{relativeTime(v?.last_synced)}</span>
            </div>
            {r.company_number && !isSyncing && (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); handleRowSync(r); }}
                aria-label="Sync now"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            )}
          </div>
        );
      },
      hideOnMobile: true,
    },
    {
      key: 'accounts',
      header: 'Accounts',
      render: (r) =>
        r.company_number && r.verification?.ch_accounts_next_due ? (
          <ComplianceStatusIndicator dueDate={r.verification.ch_accounts_next_due} />
        ) : r.company_number ? <span className="text-xs text-muted-foreground">Not synced</span>
        : <span className="text-xs text-muted-foreground">—</span>,
      hideOnMobile: true,
    },
    {
      key: 'conf',
      header: 'Conf. Stmt',
      render: (r) =>
        r.company_number && r.verification?.ch_confirmation_next_due ? (
          <ComplianceStatusIndicator dueDate={r.verification.ch_confirmation_next_due} />
        ) : r.company_number ? <span className="text-xs text-muted-foreground">Not synced</span>
        : <span className="text-xs text-muted-foreground">—</span>,
      hideOnMobile: true,
    },
  ];

  // Wrap render to add group-hover via custom mobileCardRender? Simpler: add wrapper className via Card
  return (
    <AppLayout>
      <SEO title="Entities — TenureIQ" description="Manage SPVs, partnerships, and trusts with Companies House data built in." />
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Entities</h1>
            <p className="text-muted-foreground">Manage your legal entities, directors, shareholders, and entity-level portfolio performance</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => handleExportCSV(filtered)} disabled={filtered.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={handleBulkSync} disabled={bulkSyncing}>
              {bulkSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Sync all SPVs
            </Button>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Entity
            </Button>
          </div>
        </div>

        {!isLoading && (
          <EntitiesKPIStrip
            total={totals.total}
            typeBreakdown={totals.breakdown}
            totalValue={totals.totalValue}
            totalDebt={totals.totalDebt}
            blendedLTV={totals.blendedLTV}
            filingsAttention={totals.attention}
            onClickFilings={() => setFilterChip('filings_overdue')}
          />
        )}

        <div className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name or company number..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <EntitiesFilterChips active={filterChip} onChange={setFilterChip} counts={chipCounts} />
        </div>

        {isLoading ? (
          <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : (
          <Card className="overflow-hidden">
            {/* select-all header for desktop only */}
            <div className="hidden md:flex items-center gap-3 border-b px-4 py-2 bg-muted/30">
              <Checkbox
                checked={filtered.length > 0 && selected.size === filtered.length}
                onCheckedChange={toggleAll}
                aria-label="Select all"
              />
              <span className="text-xs text-muted-foreground">
                {selected.size > 0 ? `${selected.size} selected` : `${filtered.length} ${filtered.length === 1 ? 'entity' : 'entities'}`}
              </span>
            </div>
            <div className="[&_tbody_tr]:group">
              <ResponsiveTable<Row>
                columns={columns}
                data={filtered}
                keyExtractor={(r) => r.id}
                onRowClick={(r) => navigate(`/entities/${r.id}`)}
                emptyMessage={search || filterChip !== 'all' ? 'No entities match your filters.' : 'No entities yet. Click "Add Entity" to get started.'}
              />
            </div>
          </Card>
        )}
      </div>

      <BulkActionBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        itemLabel="entity"
      >
        <Button size="sm" variant="outline" onClick={handleBulkSyncSelected} disabled={bulkSyncing}>
          {bulkSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Sync selected
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleExportCSV(filtered.filter((r) => selected.has(r.id)))}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
        <Button size="sm" variant="outline" onClick={handleBulkMarkDormant}>
          <Archive className="h-4 w-4 mr-2" />
          Mark dormant
        </Button>
      </BulkActionBar>

      <EntityFormModal open={showAddModal} onOpenChange={setShowAddModal} />
    </AppLayout>
  );
}
