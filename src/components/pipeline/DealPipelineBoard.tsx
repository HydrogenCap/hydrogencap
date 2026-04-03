import { useState, useMemo } from 'react';
import { differenceInDays } from 'date-fns';
import {
  Search,
  MapPin,
  TrendingUp,
  ArrowRight,
  Eye,
  Handshake,
  ClipboardCheck,
  FileCheck,
  Home,
  BarChart3,
  Filter,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatGBP, formatPercent } from '@/lib/calculations';
import {
  useDeals,
  useUpdateDealStage,
  useDealStats,
  KANBAN_DEAL_STAGES,
  DEAL_STAGE_LABELS,
  DEAL_STAGE_ORDER,
  LISTING_SOURCE_LABELS,
  type DealStage,
  type DealPipelineItem,
  type DealFilters,
  type ListingSource,
} from '@/hooks/useDealPipeline';

const STAGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sourced: Search,
  analysed: BarChart3,
  viewing_booked: Eye,
  viewed: Eye,
  offer_made: Handshake,
  offer_accepted: Handshake,
  due_diligence: ClipboardCheck,
  exchanged: FileCheck,
};

function nextStage(current: DealStage): DealStage | null {
  const idx = DEAL_STAGE_ORDER.indexOf(current);
  if (idx < 0 || idx >= DEAL_STAGE_ORDER.length - 1) return null;
  return DEAL_STAGE_ORDER[idx + 1];
}

function DaysInStageBadge({ item }: { item: DealPipelineItem }) {
  const days = differenceInDays(new Date(), new Date(item.updated_at));
  return (
    <Badge
      variant={days > 30 ? 'destructive' : days > 14 ? 'secondary' : 'outline'}
      className="text-xs"
    >
      {days}d
    </Badge>
  );
}

function DealCard({
  deal,
  onAdvance,
  onSelect,
}: {
  deal: DealPipelineItem;
  onAdvance: (deal: DealPipelineItem) => void;
  onSelect: (deal: DealPipelineItem) => void;
}) {
  const next = nextStage(deal.stage);

  return (
    <Card className="mb-3 hover:shadow-md transition-shadow cursor-pointer" onClick={() => onSelect(deal)}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{deal.address}</p>
            {deal.postcode && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <MapPin className="h-3 w-3 shrink-0" />
                {deal.postcode}
              </div>
            )}
          </div>
          <DaysInStageBadge item={deal} />
        </div>

        {/* Price & Yield */}
        <div className="flex items-center justify-between text-xs">
          {deal.asking_price ? (
            <span className="font-medium">{formatGBP(deal.asking_price)}</span>
          ) : (
            <span className="text-muted-foreground">No price</span>
          )}
          {deal.estimated_yield ? (
            <span className="text-emerald-600 font-medium flex items-center gap-0.5">
              <TrendingUp className="h-3 w-3" />
              {formatPercent(deal.estimated_yield)}
            </span>
          ) : null}
        </div>

        {/* Property info */}
        {(deal.beds || deal.property_type) && (
          <p className="text-xs text-muted-foreground">
            {deal.beds ? `${deal.beds} bed` : ''}
            {deal.beds && deal.property_type ? ' · ' : ''}
            {deal.property_type || ''}
          </p>
        )}

        {/* Source badge */}
        {deal.listing_source && (
          <Badge variant="outline" className="text-xs">
            {LISTING_SOURCE_LABELS[deal.listing_source]}
          </Badge>
        )}

        {/* Advance button */}
        {next && (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={e => {
              e.stopPropagation();
              onAdvance(deal);
            }}
          >
            {DEAL_STAGE_LABELS[next]} <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function StatsBar() {
  const stats = useDealStats();

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">In Pipeline</p>
          <p className="text-xl font-bold">{stats.totalInPipeline}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total Value</p>
          <p className="text-xl font-bold">{formatGBP(stats.totalValue)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Avg Yield</p>
          <p className="text-xl font-bold">{formatPercent(stats.avgYield)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Conversion Rate</p>
          <p className="text-xl font-bold">{formatPercent(stats.conversionRate)}</p>
        </CardContent>
      </Card>
    </div>
  );
}

interface DealPipelineBoardProps {
  onSelectDeal: (deal: DealPipelineItem) => void;
}

export function DealPipelineBoard({ onSelectDeal }: DealPipelineBoardProps) {
  const [filters, setFilters] = useState<DealFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const { data: deals, isLoading } = useDeals(filters);
  const updateStage = useUpdateDealStage();

  const grouped = useMemo(() => {
    const map: Record<DealStage, DealPipelineItem[]> = {} as Record<DealStage, DealPipelineItem[]>;
    for (const stage of KANBAN_DEAL_STAGES) {
      map[stage] = [];
    }
    for (const deal of deals || []) {
      if (map[deal.stage]) {
        map[deal.stage].push(deal);
      }
    }
    return map;
  }, [deals]);

  const handleAdvance = (deal: DealPipelineItem) => {
    const next = nextStage(deal.stage);
    if (!next) return;
    updateStage.mutate({ id: deal.id, stage: next });
  };

  const clearFilters = () => {
    setFilters({});
    setShowFilters(false);
  };

  const hasFilters = filters.source || filters.propertyType || filters.minPrice || filters.maxPrice;

  return (
    <div className="space-y-4">
      <StatsBar />

      {/* Filter toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant={showFilters ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-4 w-4 mr-1" />
          Filters
          {hasFilters && (
            <Badge variant="destructive" className="ml-1 text-xs px-1">
              !
            </Badge>
          )}
        </Button>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Source</Label>
                <Select
                  value={filters.source || ''}
                  onValueChange={v =>
                    setFilters(prev => ({
                      ...prev,
                      source: (v || undefined) as ListingSource | undefined,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All sources" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LISTING_SOURCE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Property Type</Label>
                <Input
                  placeholder="e.g. Terraced"
                  value={filters.propertyType || ''}
                  onChange={e =>
                    setFilters(prev => ({
                      ...prev,
                      propertyType: e.target.value || undefined,
                    }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Min Price (£)</Label>
                <Input
                  type="number"
                  placeholder="100000"
                  value={filters.minPrice ?? ''}
                  onChange={e =>
                    setFilters(prev => ({
                      ...prev,
                      minPrice: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Max Price (£)</Label>
                <Input
                  type="number"
                  placeholder="500000"
                  value={filters.maxPrice ?? ''}
                  onChange={e =>
                    setFilters(prev => ({
                      ...prev,
                      maxPrice: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kanban board */}
      {isLoading ? (
        <p className="text-muted-foreground text-center py-12">Loading pipeline...</p>
      ) : (
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-4" style={{ minWidth: `${KANBAN_DEAL_STAGES.length * 240}px` }}>
            {KANBAN_DEAL_STAGES.map(stage => {
              const stageDeals = grouped[stage] || [];
              const Icon = STAGE_ICONS[stage] || Home;
              return (
                <div key={stage} className="w-[240px] shrink-0">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">{DEAL_STAGE_LABELS[stage]}</h3>
                    <Badge variant="outline" className="text-xs">
                      {stageDeals.length}
                    </Badge>
                  </div>
                  <div
                    className={cn(
                      'min-h-[200px] rounded-lg border border-dashed p-2',
                      stageDeals.length === 0 && 'flex items-center justify-center'
                    )}
                  >
                    {stageDeals.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Empty</p>
                    ) : (
                      stageDeals.map(deal => (
                        <DealCard
                          key={deal.id}
                          deal={deal}
                          onAdvance={handleAdvance}
                          onSelect={onSelectDeal}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
    </div>
  );
}
