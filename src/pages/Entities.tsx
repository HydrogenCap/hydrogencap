import { useState, useMemo, useEffect, useRef, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Building2, User, Handshake, Shield, CheckCircle, AlertTriangle, RefreshCw, Loader2, AlertCircle as AlertCircleIcon, CheckCircle2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import { useEntityVerificationStatus, useSyncEntity, type EntityVerification } from '@/hooks/useCompaniesHouseV2';
import { usePropertiesV2 } from '@/hooks/usePropertiesV2';
import { useAllLoanFacilities } from '@/hooks/useLoanFacilities';
import { usePropertyRoomSummaries } from '@/hooks/useRoomsV2';
import { getComplianceStatus } from '@/lib/complianceStatus';
import { EntityFormModal } from '@/components/entities/EntityFormModal';
import { useToast } from '@/hooks/use-toast';
import { SEO } from '@/components/SEO';

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

function formatGBP(value: number | null | undefined) {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(1)}%`;
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

export default function Entities() {
  const { data: entities, isLoading } = useLegalEntities();
  const { data: verifications } = useEntityVerificationStatus();
  const { data: allPropertiesV2 } = usePropertiesV2();
  const { data: loans } = useAllLoanFacilities();
  const { data: roomSummaries } = usePropertyRoomSummaries();
  const syncEntity = useSyncEntity();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'status' | 'value' | 'debt' | 'ltv'>('name');
  const [showAddModal, setShowAddModal] = useState(false);
  const [bulkSyncing, setBulkSyncing] = useState(false);

  const verificationMap = useMemo(() => {
    const map: Record<string, EntityVerification> = {};
    verifications?.forEach(v => { map[v.entity_id] = v; });
    return map;
  }, [verifications]);

  const entityMetricsMap = useMemo(() => {
    const map = new Map<string, EntityMetrics>();
    const propertyIdToEntity = new Map<string, string>();

    allPropertiesV2?.forEach((property) => {
      propertyIdToEntity.set(property.id, property.entity_id);
      const current = map.get(property.entity_id) || { propertyCount: 0, totalValue: 0, totalDebt: 0, monthlyRent: 0, ltv: null };
      const monthlyRent = property.rent_basis === 'whole_house'
        ? (property.whole_house_rent_pcm || 0)
        : (roomSummaries?.get(property.id)?.gross_rent_pcm || 0);
      map.set(property.entity_id, {
        ...current,
        propertyCount: current.propertyCount + 1,
        totalValue: current.totalValue + (property.current_valuation || 0),
        monthlyRent: current.monthlyRent + monthlyRent,
      });
    });

    loans?.forEach((loan) => {
      if (!['active', 'drawdown', 'pending_drawdown'].includes(loan.status)) return;
      const entityId = propertyIdToEntity.get(loan.property_id) || loan.entity_id;
      const current = map.get(entityId) || { propertyCount: 0, totalValue: 0, totalDebt: 0, monthlyRent: 0, ltv: null };
      map.set(entityId, {
        ...current,
        totalDebt: current.totalDebt + (loan.current_balance || 0),
      });
    });

    map.forEach((metrics, entityId) => {
      map.set(entityId, {
        ...metrics,
        ltv: metrics.totalValue > 0 ? (metrics.totalDebt / metrics.totalValue) * 100 : null,
      });
    });

    return map;
  }, [allPropertiesV2, loans, roomSummaries]);

  const filtered = useMemo(() => {
    if (!entities) return [];
    const result = entities.filter(e =>
      e.entity_name.toLowerCase().includes(search.toLowerCase()) ||
      (e.company_number && e.company_number.toLowerCase().includes(search.toLowerCase()))
    );
    result.sort((a, b) => {
      if (sortBy === 'name') return a.entity_name.localeCompare(b.entity_name);
      if (sortBy === 'type') return a.entity_type.localeCompare(b.entity_type);
      if (sortBy === 'status') return a.status.localeCompare(b.status);
      const aMetrics = entityMetricsMap.get(a.id);
      const bMetrics = entityMetricsMap.get(b.id);
      if (sortBy === 'value') return (bMetrics?.totalValue || 0) - (aMetrics?.totalValue || 0);
      if (sortBy === 'debt') return (bMetrics?.totalDebt || 0) - (aMetrics?.totalDebt || 0);
      if (sortBy === 'ltv') return (bMetrics?.ltv || 0) - (aMetrics?.ltv || 0);
      return 0;
    });
    return result;
  }, [entities, search, sortBy, entityMetricsMap]);

  const handleBulkSync = async () => {
    const spvs = entities?.filter(e => e.entity_type === 'spv' && e.company_number) || [];
    if (spvs.length === 0) { toast({ title: 'No SPVs with company numbers to sync' }); return; }
    setBulkSyncing(true);
    let synced = 0;
    for (const spv of spvs) {
      try {
        await syncEntity.mutateAsync({ entityId: spv.id, companyNumber: spv.company_number! });
        synced++;
      } catch (err) { console.error('Failed to sync entity:', err); /* continue */ }
      await new Promise(r => setTimeout(r, 500));
    }
    setBulkSyncing(false);
    const issues = verifications?.filter(v => v.verification_status === 'status_mismatch').length || 0;
    const overdue = verifications?.filter(v => v.accounts_filing_status === 'overdue' || v.confirmation_filing_status === 'overdue').length || 0;
    toast({ title: `Synced ${synced} SPVs. ${issues} discrepancies. ${overdue} overdue filings.` });
  };

  const CHStatusCell = ({ entityId, entityType }: { entityId: string; entityType: string }) => {
    if (entityType !== 'spv' && entityType !== 'ltd_company') return <span className="text-muted-foreground text-xs">N/A</span>;
    const v = verificationMap[entityId];
    if (!v || v.verification_status === 'not_synced') return <Badge variant="secondary" className="text-xs">Not Synced</Badge>;
    if (v.verification_status === 'verified') return <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> Verified</span>;
    return <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Mismatch</span>;
  };

  return (
    <AppLayout>
      <SEO title="Entities — TenureIQ" description="Manage SPVs, partnerships, and trusts with Companies House data built in." />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Entities</h1>
            <p className="text-muted-foreground">Manage your legal entities, directors, shareholders, and entity-level portfolio performance</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleBulkSync} disabled={bulkSyncing}>
              {bulkSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Sync All SPVs
            </Button>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Entity
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or company number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Sort by Name</SelectItem>
              <SelectItem value="type">Sort by Type</SelectItem>
              <SelectItem value="status">Sort by Status</SelectItem>
              <SelectItem value="value">Sort by Value</SelectItem>
              <SelectItem value="debt">Sort by Debt</SelectItem>
              <SelectItem value="ltv">Sort by LTV</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            {search ? 'No entities match your search.' : 'No entities yet. Click "Add Entity" to get started.'}
          </div>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Properties</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Debt</TableHead>
                  <TableHead className="text-right">LTV</TableHead>
                  <TableHead className="text-right">Rent/mo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>CH Status</TableHead>
                  <TableHead>Accounts</TableHead>
                  <TableHead>Conf. Statement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((entity) => {
                  const typeConfig = TYPE_CONFIG[entity.entity_type] || DEFAULT_TYPE_CONFIG;
                  const statusConfig = STATUS_CONFIG[entity.status] || DEFAULT_STATUS_CONFIG;
                  const TypeIcon = typeConfig.icon;
                  const v = verificationMap[entity.id];
                  const metrics = entityMetricsMap.get(entity.id);
                  return (
                    <TableRow
                      key={entity.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/entities/${entity.id}`)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-semibold">{entity.entity_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{entity.company_number || 'No company number'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={typeConfig.variant} className="gap-1">
                          <TypeIcon className="h-3 w-3" />
                          {typeConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {metrics?.propertyCount || 0}
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatGBP(metrics?.totalValue)}</TableCell>
                      <TableCell className="text-right">{formatGBP(metrics?.totalDebt)}</TableCell>
                      <TableCell className="text-right">{formatPercent(metrics?.ltv)}</TableCell>
                      <TableCell className="text-right">{formatGBP(metrics?.monthlyRent)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusConfig.className}>
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell><CHStatusCell entityId={entity.id} entityType={entity.entity_type} /></TableCell>
                      <TableCell>
                        {entity.company_number && v?.ch_accounts_next_due ? (
                          <ComplianceStatusIndicator dueDate={v.ch_accounts_next_due} />
                        ) : entity.company_number ? (
                          <span className="text-xs text-muted-foreground">Not synced</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entity.company_number && v?.ch_confirmation_next_due ? (
                          <ComplianceStatusIndicator dueDate={v.ch_confirmation_next_due} />
                        ) : entity.company_number ? (
                          <span className="text-xs text-muted-foreground">Not synced</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <EntityFormModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
      />
    </AppLayout>
  );
}
