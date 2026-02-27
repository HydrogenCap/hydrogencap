import React, { useState, useMemo, useDeferredValue, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Filter,
  Search,
  TrendingDown,
  Percent,
  Zap,
  Home,
  FileWarning,
  Shield,
  ShieldAlert,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { cn } from '@/lib/utils';
import { usePortfolioRisks, RiskType, riskTypeLabels, type RiskItem } from '@/hooks/usePortfolioRisks';

type RiskTypeFilter = 'all' | RiskType;
type SeverityFilter = 'all' | 'critical' | 'warning';
type GroupMode = 'property' | 'flat';

const riskTypeIcons: Record<RiskType, React.ReactNode> = {
  ltv: <Percent className="h-4 w-4" />,
  epc: <Zap className="h-4 w-4" />,
  rate_expiry: <TrendingDown className="h-4 w-4" />,
  negative_cashflow: <TrendingDown className="h-4 w-4" />,
  hmo_licence: <Home className="h-4 w-4" />,
  operational_data: <FileWarning className="h-4 w-4" />,
  tenancy_compliance: <Shield className="h-4 w-4" />,
  insurance: <ShieldAlert className="h-4 w-4" />,
  leasehold: <Building2 className="h-4 w-4" />,
  lease_expiry: <Clock className="h-4 w-4" />,
};

function getPriorityLabel(priority: number): { label: string; className: string } {
  if (priority >= 130) return { label: 'Urgent', className: 'bg-destructive text-destructive-foreground' };
  if (priority >= 100) return { label: 'High', className: 'bg-destructive/80 text-destructive-foreground' };
  if (priority >= 70) return { label: 'Medium', className: 'bg-warning text-warning-foreground' };
  return { label: 'Low', className: 'bg-muted text-muted-foreground' };
}

/* ─── Risk Row Component ─── */
function RiskRow({ risk, onDismiss, isDismissed }: {
  risk: RiskItem;
  onDismiss: (id: string) => void;
  isDismissed: boolean;
}) {
  const navigate = useNavigate();
  const priorityInfo = getPriorityLabel(risk.priority);

  if (isDismissed) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg border transition-all cursor-pointer group',
        'hover:bg-muted/40 hover:border-primary/30 hover:shadow-sm',
        risk.severity === 'critical'
          ? 'border-destructive/20 bg-destructive/5'
          : 'border-border bg-card',
      )}
      onClick={() => navigate(risk.targetUrl)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') navigate(risk.targetUrl); }}
    >
      {/* Priority badge */}
      <Badge className={cn('text-[10px] px-1.5 py-0.5 shrink-0', priorityInfo.className)}>
        {priorityInfo.label}
      </Badge>

      {/* Severity */}
      <Badge
        variant={risk.severity === 'critical' ? 'destructive' : 'outline'}
        className={cn(
          'shrink-0',
          risk.severity === 'warning' && 'border-warning text-warning bg-warning/10'
        )}
      >
        {risk.severity === 'critical' ? 'Critical' : 'Warning'}
      </Badge>

      {/* Type icon + label */}
      <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
        {riskTypeIcons[risk.type]}
        <span className="text-xs font-medium hidden sm:inline">{riskTypeLabels[risk.type]}</span>
      </div>

      {/* Message */}
      <span className="text-sm text-foreground truncate flex-1">{risk.message}</span>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(risk.id);
          }}
          title="Dismiss"
        >
          <EyeOff className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </div>
  );
}

/* ─── Property Group Component ─── */
function PropertyGroup({ address, propertyId, risks, onDismiss, dismissedIds }: {
  address: string;
  propertyId: string;
  risks: RiskItem[];
  onDismiss: (id: string) => void;
  dismissedIds: Set<string>;
}) {
  const [expanded, setExpanded] = useState(true);
  const visibleRisks = risks.filter(r => !dismissedIds.has(r.id));
  const criticalCount = visibleRisks.filter(r => r.severity === 'critical').length;
  const maxPriority = Math.max(...visibleRisks.map(r => r.priority), 0);
  const priorityInfo = getPriorityLabel(maxPriority);

  if (visibleRisks.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', !expanded && '-rotate-90')} />
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-semibold text-foreground truncate flex-1">{address}</span>
        <Badge className={cn('text-[10px] px-1.5 py-0.5', priorityInfo.className)}>
          {priorityInfo.label}
        </Badge>
        {criticalCount > 0 && (
          <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
            {criticalCount}
          </Badge>
        )}
        <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-xs">
          {visibleRisks.length}
        </Badge>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-1.5">
          {visibleRisks.map(risk => (
            <RiskRow key={risk.id} risk={risk} onDismiss={onDismiss} isDismissed={false} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ActionsPage() {
  const navigate = useNavigate();
  const { risks, criticalCount, warningCount, totalCount, isLoading } = usePortfolioRisks();

  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [typeFilter, setTypeFilter] = useState<RiskTypeFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [groupMode, setGroupMode] = useState<GroupMode>('property');
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [showDismissed, setShowDismissed] = useState(false);

  const handleDismiss = useCallback((id: string) => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleRestoreAll = useCallback(() => setDismissedIds(new Set()), []);

  // Apply filters (priority sort comes from the hook)
  const filteredRisks = useMemo(() => {
    let result = [...risks];

    if (deferredSearch) {
      const searchLower = deferredSearch.toLowerCase();
      result = result.filter(r =>
        r.address.toLowerCase().includes(searchLower) ||
        r.message.toLowerCase().includes(searchLower)
      );
    }

    if (typeFilter !== 'all') result = result.filter(r => r.type === typeFilter);
    if (severityFilter !== 'all') result = result.filter(r => r.severity === severityFilter);

    if (!showDismissed) result = result.filter(r => !dismissedIds.has(r.id));

    return result;
  }, [risks, deferredSearch, typeFilter, severityFilter, dismissedIds, showDismissed]);

  // Group by property
  const groupedRisks = useMemo(() => {
    const groups = new Map<string, { address: string; propertyId: string; risks: RiskItem[] }>();
    for (const risk of filteredRisks) {
      const key = risk.propertyId || risk.address;
      if (!groups.has(key)) {
        groups.set(key, { address: risk.address, propertyId: risk.propertyId, risks: [] });
      }
      groups.get(key)!.risks.push(risk);
    }
    // Sort groups by max priority
    return Array.from(groups.values()).sort((a, b) => {
      const maxA = Math.max(...a.risks.map(r => r.priority));
      const maxB = Math.max(...b.risks.map(r => r.priority));
      return maxB - maxA;
    });
  }, [filteredRisks]);

  const activeCount = risks.filter(r => !dismissedIds.has(r.id)).length;
  const activeCritical = risks.filter(r => !dismissedIds.has(r.id) && r.severity === 'critical').length;
  const activeWarning = risks.filter(r => !dismissedIds.has(r.id) && r.severity === 'warning').length;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Action Required</h1>
          <p className="text-muted-foreground">
            Review and resolve portfolio risks and compliance issues
          </p>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <KpiCard
            label="Critical"
            value={activeCritical}
            icon={AlertTriangle}
            iconClassName="text-destructive"
            valueClassName="text-destructive"
            className="border-destructive/30 bg-destructive/5"
            onClick={() => setSeverityFilter(severityFilter === 'critical' ? 'all' : 'critical')}
          />
          <KpiCard
            label="Warning"
            value={activeWarning}
            icon={AlertTriangle}
            iconClassName="text-warning"
            valueClassName="text-warning"
            className="border-warning/30 bg-warning/5"
            onClick={() => setSeverityFilter(severityFilter === 'warning' ? 'all' : 'warning')}
          />
          <KpiCard
            label="Active Issues"
            value={activeCount}
            icon={Building2}
            subtitle={`${groupedRisks.length} properties affected`}
          />
          <KpiCard
            label="Dismissed"
            value={dismissedIds.size}
            icon={EyeOff}
            subtitle={dismissedIds.size > 0 ? 'Click to restore' : 'None dismissed'}
            onClick={dismissedIds.size > 0 ? handleRestoreAll : undefined}
            className={dismissedIds.size > 0 ? 'border-muted-foreground/20' : ''}
          />
        </div>

        {/* Filters Bar */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search address or issue..."
                  aria-label="Search actions"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={typeFilter} onValueChange={v => setTypeFilter(v as RiskTypeFilter)}>
                <SelectTrigger className="w-[170px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Issue Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {(Object.keys(riskTypeLabels) as RiskType[]).map(key => (
                    <SelectItem key={key} value={key}>{riskTypeLabels[key]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={severityFilter} onValueChange={v => setSeverityFilter(v as SeverityFilter)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical Only</SelectItem>
                  <SelectItem value="warning">Warning Only</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1 p-1 rounded-lg bg-muted w-fit">
                <button
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                    groupMode === 'property' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => setGroupMode('property')}
                >
                  By Property
                </button>
                <button
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                    groupMode === 'flat' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => setGroupMode('flat')}
                >
                  Flat List
                </button>
              </div>

              {dismissedIds.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setShowDismissed(!showDismissed)}
                >
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  {showDismissed ? 'Hide' : 'Show'} dismissed ({dismissedIds.size})
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {filteredRisks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 rounded-full bg-success/10">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">No Actions Required</h3>
                  <p className="text-sm text-muted-foreground">
                    {totalCount === 0
                      ? 'Your portfolio is healthy with no identified risks.'
                      : dismissedIds.size > 0
                        ? `${dismissedIds.size} issue${dismissedIds.size > 1 ? 's' : ''} dismissed. All other filters clear.`
                        : 'No results match your current filters.'}
                  </p>
                </div>
                {(typeFilter !== 'all' || severityFilter !== 'all' || search) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setTypeFilter('all'); setSeverityFilter('all'); setSearch(''); }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : groupMode === 'property' ? (
          <div className="space-y-3">
            {groupedRisks.map(group => (
              <PropertyGroup
                key={group.propertyId || group.address}
                address={group.address}
                propertyId={group.propertyId}
                risks={group.risks}
                onDismiss={handleDismiss}
                dismissedIds={dismissedIds}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredRisks.map(risk => (
              <RiskRow
                key={risk.id}
                risk={risk}
                onDismiss={handleDismiss}
                isDismissed={dismissedIds.has(risk.id)}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
