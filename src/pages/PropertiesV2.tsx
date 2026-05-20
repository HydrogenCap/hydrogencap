import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Building2, Zap } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, SavedViewsMenu } from '@/components/common';
import { ListState } from '@/components/ListState';

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { usePropertiesV2, usePropertyComplianceStatusMap, PROPERTY_TYPES, LIFECYCLE_STAGES, LISTING_GRADES, type PropertyComplianceStatus } from '@/hooks/usePropertiesV2';
import { usePropertyRoomSummaries } from '@/hooks/useRoomsV2';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import { PropertyWizard } from '@/components/properties-v2/wizard/PropertyWizard';
import { usePropertyPhotosV2 } from '@/hooks/usePropertyPhotosV2';
import { useBulkEpcEnrichV2 } from '@/hooks/useBulkEpcEnrichV2';
import type { PropertyWithEntity } from '@/hooks/usePropertiesV2';
import type { PropertyRoomSummary } from '@/hooks/useRoomsV2';
import { SEO } from '@/components/SEO';

// Badge colour maps
const ENTITY_TYPE_BG: Record<string, string> = {
  spv: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  personal: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  joint_venture: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  trust: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

const PROPERTY_TYPE_BG: Record<string, string> = {
  hmo_licensed: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  hmo_mandatory: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  single_let: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  multi_unit_freehold: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  commercial: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300',
  mixed_use: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300',
};

const LIFECYCLE_BG: Record<string, string> = {
  pipeline: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  acquisition: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  refurbishment: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  letting: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  stabilised: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  disposal: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const LIFECYCLE_BORDER: Record<string, string> = {
  pipeline: 'border-l-blue-500',
  acquisition: 'border-l-sky-500',
  refurbishment: 'border-l-orange-500',
  letting: 'border-l-purple-500',
  stabilised: 'border-l-emerald-500',
  disposal: 'border-l-red-500',
};

const COMPLIANCE_DOT: Record<PropertyComplianceStatus, string> = {
  grey: 'bg-muted-foreground/60',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
};

function formatGBP(value: number | null) {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatGBPShort(value: number) {
  if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `£${(value / 1_000).toFixed(0)}k`;
  return `£${value}`;
}

function getPropertyTypeLabel(value: string) {
  return PROPERTY_TYPES.find(t => t.value === value)?.label || value;
}

function getLifecycleLabel(value: string) {
  return LIFECYCLE_STAGES.find(s => s.value === value)?.label || value;
}

type PropertySortOption = 'address_asc' | 'purchase_date_desc' | 'purchase_date_asc' | 'valuation_desc' | 'valuation_asc';

export default function PropertiesV2() {
  const { data: properties, isLoading, error, refetch } = usePropertiesV2();
  const { data: roomSummaries } = usePropertyRoomSummaries();
  const { data: entities } = useLegalEntities();
  const { data: photoMap } = usePropertyPhotosV2();
  const { data: complianceStatusMap } = usePropertyComplianceStatusMap();
  const { enrichAll: enrichEpc, isEnriching: isEnrichingEpc } = useBulkEpcEnrichV2();
  
  const navigate = useNavigate();
  const [showWizard, setShowWizard] = useState(false);
  const [search, setSearch] = useState('');
  const [filterEntity, setFilterEntity] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterStage, setFilterStage] = useState('all');
  const [filterListing, setFilterListing] = useState('all');
  const [sort, setSort] = useState<PropertySortOption>('address_asc');

  const filtered = useMemo(() => {
    if (!properties) return [];
    let result = [...properties];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.address_line_1.toLowerCase().includes(q) ||
        p.postcode.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q)
      );
    }
    if (filterEntity !== 'all') result = result.filter(p => p.entity_id === filterEntity);
    if (filterType !== 'all') result = result.filter(p => p.property_type === filterType);
    if (filterStage !== 'all') result = result.filter(p => p.lifecycle_stage === filterStage);
    if (filterListing !== 'all') result = result.filter(p => p.listing_grade === filterListing);

    result.sort((a, b) => {
      switch (sort) {
        case 'address_asc': return a.address_line_1.localeCompare(b.address_line_1);
        case 'purchase_date_desc': return (b.purchase_date || '').localeCompare(a.purchase_date || '');
        case 'purchase_date_asc': return (a.purchase_date || '').localeCompare(b.purchase_date || '');
        case 'valuation_desc': return (b.current_valuation || 0) - (a.current_valuation || 0);
        case 'valuation_asc': return (a.current_valuation || 0) - (b.current_valuation || 0);
        default: return 0;
      }
    });
    return result;
  }, [properties, search, filterEntity, filterType, filterStage, filterListing, sort]);

  // Stats
  const totalCount = properties?.length || 0;
  const totalValuation = properties?.reduce((s, p) => s + (p.current_valuation || 0), 0) || 0;
  const avgRooms = totalCount > 0
    ? (properties!.reduce((s, p) => s + (p.total_lettable_rooms || 0), 0) / totalCount).toFixed(1)
    : '0';
  const totalMonthlyRent = useMemo(() => {
    let total = 0;
    properties?.forEach(p => {
      if (p.rent_basis === 'whole_house') {
        total += p.whole_house_rent_pcm || 0;
      } else {
        total += roomSummaries?.get(p.id)?.gross_rent_pcm || 0;
      }
    });
    return total;
  }, [properties, roomSummaries]);
  const stageCounts = useMemo(() => {
    const m: Record<string, number> = {};
    properties?.forEach(p => { m[p.lifecycle_stage] = (m[p.lifecycle_stage] || 0) + 1; });
    return m;
  }, [properties]);

  return (
    <AppLayout>
      <SEO title="Properties — TenureIQ" description="Track every property in one place — tenants, compliance, finance, and documents." />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Properties</h1>
            <p className="text-sm text-muted-foreground">Manage your portfolio properties</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => enrichEpc('missing-only')} disabled={isEnrichingEpc}>
              <Zap className="h-4 w-4 mr-2" /> {isEnrichingEpc ? 'Enriching…' : 'Enrich EPC'}
            </Button>
            <Button size="sm" onClick={() => setShowWizard(true)}><Plus className="h-4 w-4 mr-2" /> Add Property</Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
          <Card><CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Properties</p>
            <p className="text-xl md:text-2xl font-bold text-foreground">{totalCount}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Valuation</p>
            <p className="text-xl md:text-2xl font-bold text-foreground">{totalValuation > 0 ? formatGBPShort(totalValuation) : '—'}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Monthly Rent</p>
            <p className="text-xl md:text-2xl font-bold text-foreground">{totalMonthlyRent > 0 ? formatGBP(totalMonthlyRent) : '—'}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg Rooms</p>
            <p className="text-xl md:text-2xl font-bold text-foreground">{avgRooms}</p>
          </CardContent></Card>
          <Card className="hidden md:block"><CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Stage Breakdown</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {LIFECYCLE_STAGES.map(s => {
                const c = stageCounts[s.value];
                if (!c) return null;
                return (
                  <span key={s.value} className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full ${LIFECYCLE_BG[s.value]}`}>
                    {c}
                  </span>
                );
              })}
              {totalCount === 0 && <span className="text-sm text-muted-foreground">—</span>}
            </div>
          </CardContent></Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 md:gap-3 items-center">
          <div className="relative w-full md:flex-1 md:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input aria-label="Search properties by address or postcode" placeholder="Search address or postcode..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterEntity} onValueChange={setFilterEntity}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Entity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              {entities?.map(e => <SelectItem key={e.id} value={e.id}>{e.entity_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {PROPERTY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStage} onValueChange={setFilterStage}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Stage" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {LIFECYCLE_STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterListing} onValueChange={setFilterListing}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Listing" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Grade</SelectItem>
              {LISTING_GRADES.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={v => setSort(v as PropertySortOption)}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="address_asc">Address A–Z</SelectItem>
              <SelectItem value="purchase_date_desc">Purchase Date (Newest)</SelectItem>
              <SelectItem value="purchase_date_asc">Purchase Date (Oldest)</SelectItem>
              <SelectItem value="valuation_desc">Valuation (Highest)</SelectItem>
              <SelectItem value="valuation_asc">Valuation (Lowest)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Grid */}
        <ListState
          isLoading={isLoading}
          error={error as Error | null}
          isEmpty={!properties || properties.length === 0}
          emptyIcon={Building2}
          emptyTitle="No properties yet"
          emptyDescription="Add your first property to start tracking compliance, rent, and portfolio performance."
          emptyAction={{ label: 'Add Property', onClick: () => setShowWizard(true) }}
          onRetry={() => refetch()}
        >
          {filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No properties match your filters"
              description="Try adjusting your search or filter criteria."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(p => (
                <PropertyCard
                  key={p.id}
                  property={p}
                  roomSummary={roomSummaries?.get(p.id)}
                  complianceStatus={complianceStatusMap?.get(p.id) ?? 'grey'}
                  photoUrl={photoMap?.get(p.id)}
                  onClick={() => navigate(`/properties-v2/${p.id}`)}
                />
              ))}
            </div>
          )}
        </ListState>
      </div>

      <PropertyWizard open={showWizard} onOpenChange={setShowWizard} />
    </AppLayout>
  );
}

function PropertyCard({ property: p, roomSummary, complianceStatus, photoUrl, onClick }: { property: PropertyWithEntity; roomSummary?: PropertyRoomSummary; complianceStatus: PropertyComplianceStatus; photoUrl?: string; onClick: () => void }) {
  const isWholeHouse = p.rent_basis === 'whole_house';
  const occupied = roomSummary?.total_occupied ?? 0;
  const lettable = roomSummary?.total_lettable ?? (p.total_lettable_rooms || 0);
  const grossRent = isWholeHouse ? (p.whole_house_rent_pcm ?? 0) : (roomSummary?.gross_rent_pcm ?? 0);
  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${LIFECYCLE_BORDER[p.lifecycle_stage] || 'border-l-border'} overflow-hidden`}
      onClick={onClick}
    >
      {photoUrl && (
        <div className="h-32 w-full overflow-hidden">
          <img src={photoUrl} alt={p.address_line_1} loading="lazy" width={400} height={128} className="w-full h-full object-cover" />
        </div>
      )}
      <CardContent className="pt-4 pb-3 space-y-2">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{p.address_line_1}</p>
            <p className="text-sm text-muted-foreground">{p.city}, {p.postcode}</p>
          </div>
          <div className={`h-2.5 w-2.5 rounded-full mt-1.5 flex-shrink-0 ${COMPLIANCE_DOT[complianceStatus]}`} title={`Compliance: ${complianceStatus}`} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className={`text-xs ${ENTITY_TYPE_BG[p.entity_type] || ''}`}>{p.entity_name}</Badge>
          <Badge variant="secondary" className={`text-xs ${PROPERTY_TYPE_BG[p.property_type] || ''}`}>{getPropertyTypeLabel(p.property_type)}</Badge>
          <Badge variant="secondary" className={`text-xs ${LIFECYCLE_BG[p.lifecycle_stage] || ''}`}>{getLifecycleLabel(p.lifecycle_stage)}</Badge>
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground pt-1">
          <span>{isWholeHouse ? 'Whole house' : `${occupied}/${lettable} rooms`}</span>
          <span>{grossRent > 0 ? formatGBP(grossRent) + ' /mo' : '—'}</span>
        </div>
      </CardContent>
    </Card>
  );
}
