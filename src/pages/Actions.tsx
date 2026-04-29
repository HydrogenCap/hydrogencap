import React, { useState, useMemo, useDeferredValue, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
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
  UserPlus,
  AlarmClock,
  PlayCircle,
  User,
  Wrench,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useActivitySidebar } from '@/state/activitySidebar';
import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { cn } from '@/lib/utils';
import { SEVERITY } from '@/lib/design-tokens';
import { usePortfolioRisks, RiskType, riskTypeLabels, type RiskItem } from '@/hooks/usePortfolioRisks';
import {
  useSnoozedActions,
  useActionAssignments,
  useUnsnoozeAction,
  isSnoozed,
  getAssignment,
  type ActionSnooze,
  type ActionAssignment,
} from '@/hooks/useActionWorkflows';
import { useOrgMembers, type OrgMember } from '@/hooks/useOrgMembers';
import { useContractors, type Contractor } from '@/hooks/useContractors';
import { ResolveActionDialog } from '@/components/actions/ResolveActionDialog';
import { SnoozeActionDialog } from '@/components/actions/SnoozeActionDialog';
import { AssignActionPopover } from '@/components/actions/AssignActionPopover';
import { TenancyChecklistSummaryCard } from '@/components/lettings/TenancyChecklist';

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
function RiskRow({
  risk,
  snoozeData,
  assignment,
  memberMap,
  contractorMap,
  onResolve,
  onSnooze,
  onUnsnooze,
}: {
  risk: RiskItem;
  snoozeData?: ActionSnooze;
  assignment?: ActionAssignment;
  memberMap: Map<string, OrgMember>;
  contractorMap: Map<string, Contractor>;
  onResolve: (risk: RiskItem) => void;
  onSnooze: (risk: RiskItem) => void;
  onUnsnooze: (snoozeId: string) => void;
}) {
  const navigate = useNavigate();
  const priorityInfo = getPriorityLabel(risk.priority);
  const isSnoozedItem = !!snoozeData;

  // Resolve assignee display
  let assigneeName: string | null = null;
  let assigneeIcon: React.ReactNode = null;
  if (assignment?.assigned_to_user_id) {
    const member = memberMap.get(assignment.assigned_to_user_id);
    assigneeName = member?.full_name || member?.email || 'Team member';
    assigneeIcon = <User className="h-3 w-3" />;
  } else if (assignment?.assigned_to_contractor_id) {
    const contractor = contractorMap.get(assignment.assigned_to_contractor_id);
    assigneeName = contractor?.name || 'Contractor';
    assigneeIcon = <Wrench className="h-3 w-3" />;
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg border transition-all group',
        isSnoozedItem && 'opacity-50',
        risk.severity === 'critical'
          ? cn(SEVERITY.critical.border, SEVERITY.critical.bg)
          : 'border-border bg-card',
        !isSnoozedItem && 'cursor-pointer hover:bg-muted/40 hover:border-primary/30 hover:shadow-sm',
      )}
      onClick={() => !isSnoozedItem && navigate(risk.targetUrl)}
      role={isSnoozedItem ? undefined : 'button'}
      tabIndex={isSnoozedItem ? undefined : 0}
      onKeyDown={(e) => { if (e.key === 'Enter' && !isSnoozedItem) navigate(risk.targetUrl); }}
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

      {/* Assignee badge */}
      {assigneeName && (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 gap-1 shrink-0">
          {assigneeIcon}
          {assigneeName}
        </Badge>
      )}

      {/* Snooze info */}
      {isSnoozedItem && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 gap-1 shrink-0 border-muted-foreground/30">
          <AlarmClock className="h-3 w-3" />
          Until {format(new Date(snoozeData.snoozed_until), 'dd MMM')}
        </Badge>
      )}

      {/* Action buttons */}
      <div
        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={e => e.stopPropagation()}
      >
        {isSnoozedItem ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onUnsnooze(snoozeData.id)}
            title="Unsnooze"
          >
            <AlarmClock className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={() => onResolve(risk)}
              title="Resolve"
            >
              <PlayCircle className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onSnooze(risk)}
              title="Snooze"
            >
              <AlarmClock className="h-3.5 w-3.5" />
            </Button>
            <AssignActionPopover
              risk={risk}
              assignment={assignment}
              memberMap={memberMap}
              contractorMap={contractorMap}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Assign"
              >
                <UserPlus className="h-3.5 w-3.5" />
              </Button>
            </AssignActionPopover>
          </>
        )}
      </div>

      {!isSnoozedItem && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
    </div>
  );
}

/* ─── Property Group Component ─── */
function PropertyGroup({
  address,
  propertyId: _propertyId,
  risks,
  snoozes,
  assignments,
  memberMap,
  contractorMap,
  onResolve,
  onSnooze,
  onUnsnooze,
}: {
  address: string;
  propertyId: string;
  risks: RiskItem[];
  snoozes: ActionSnooze[];
  assignments: ActionAssignment[];
  memberMap: Map<string, OrgMember>;
  contractorMap: Map<string, Contractor>;
  onResolve: (risk: RiskItem) => void;
  onSnooze: (risk: RiskItem) => void;
  onUnsnooze: (snoozeId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const criticalCount = risks.filter(r => r.severity === 'critical').length;
  const maxPriority = Math.max(...risks.map(r => r.priority), 0);
  const priorityInfo = getPriorityLabel(maxPriority);

  if (risks.length === 0) return null;

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
          {risks.length}
        </Badge>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-1.5">
          {risks.map(risk => (
            <RiskRow
              key={risk.id}
              risk={risk}
              snoozeData={isSnoozed(risk.id, snoozes)}
              assignment={getAssignment(risk.id, assignments)}
              memberMap={memberMap}
              contractorMap={contractorMap}
              onResolve={onResolve}
              onSnooze={onSnooze}
              onUnsnooze={onUnsnooze}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ActionsPanel() {
  const { risks, criticalCount: _criticalCount, warningCount: _warningCount, totalCount, isLoading } = usePortfolioRisks();

  // Workflow data
  const { data: snoozes = [] } = useSnoozedActions();
  const { data: assignments = [] } = useActionAssignments();
  const { data: members = [] } = useOrgMembers();
  const { data: contractors = [] } = useContractors({ isActive: true });
  const unsnoozeMutation = useUnsnoozeAction();

  // Build lookup maps
  const memberMap = useMemo(() => {
    const map = new Map<string, OrgMember>();
    members.forEach(m => map.set(m.user_id, m));
    return map;
  }, [members]);

  const contractorMap = useMemo(() => {
    const map = new Map<string, Contractor>();
    contractors.forEach(c => map.set(c.id, c));
    return map;
  }, [contractors]);

  // Snoozed risk IDs set for quick lookup
  const snoozedRiskIds = useMemo(() => {
    const set = new Set<string>();
    for (const s of snoozes) {
      set.add(s.action_key);
    }
    return set;
  }, [snoozes]);

  // Filters
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [typeFilter, setTypeFilter] = useState<RiskTypeFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [groupMode, setGroupMode] = useState<GroupMode>('property');
  const [showSnoozed, setShowSnoozed] = useState(false);

  // Dialog state
  const [resolveRisk, setResolveRisk] = useState<RiskItem | null>(null);
  const [snoozeRisk, setSnoozeRisk] = useState<RiskItem | null>(null);

  const handleResolve = useCallback((risk: RiskItem) => setResolveRisk(risk), []);
  const handleSnooze = useCallback((risk: RiskItem) => setSnoozeRisk(risk), []);
  const handleUnsnooze = useCallback((snoozeId: string) => unsnoozeMutation.mutate(snoozeId), [unsnoozeMutation]);

  // Apply filters
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

    // Separate snoozed and active
    if (!showSnoozed) {
      result = result.filter(r => !snoozedRiskIds.has(r.id));
    }

    return result;
  }, [risks, deferredSearch, typeFilter, severityFilter, snoozedRiskIds, showSnoozed]);

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
    return Array.from(groups.values()).sort((a, b) => {
      const maxA = Math.max(...a.risks.map(r => r.priority));
      const maxB = Math.max(...b.risks.map(r => r.priority));
      return maxB - maxA;
    });
  }, [filteredRisks]);

  const activeCount = risks.filter(r => !snoozedRiskIds.has(r.id)).length;
  const activeCritical = risks.filter(r => !snoozedRiskIds.has(r.id) && r.severity === 'critical').length;
  const activeWarning = risks.filter(r => !snoozedRiskIds.has(r.id) && r.severity === 'warning').length;
  const snoozedCount = snoozes.length;

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
            className={cn(SEVERITY.critical.border, SEVERITY.critical.bg)}
            onClick={() => setSeverityFilter(severityFilter === 'critical' ? 'all' : 'critical')}
          />
          <KpiCard
            label="Warning"
            value={activeWarning}
            icon={AlertTriangle}
            iconClassName="text-warning"
            valueClassName="text-warning"
            className={cn(SEVERITY.warning.border, SEVERITY.warning.bg)}
            onClick={() => setSeverityFilter(severityFilter === 'warning' ? 'all' : 'warning')}
          />
          <KpiCard
            label="Active Issues"
            value={activeCount}
            icon={Building2}
            subtitle={`${groupedRisks.length} properties affected`}
          />
          <KpiCard
            label="Snoozed"
            value={snoozedCount}
            icon={AlarmClock}
            subtitle={snoozedCount > 0 ? 'Click to toggle' : 'None snoozed'}
            onClick={snoozedCount > 0 ? () => setShowSnoozed(!showSnoozed) : undefined}
            className={snoozedCount > 0 ? 'border-muted-foreground/20' : ''}
          />
        </div>

        {/* Tenancy Checklist Summary */}
        <TenancyChecklistSummaryCard />

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

              {snoozedCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setShowSnoozed(!showSnoozed)}
                >
                  {showSnoozed ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
                  {showSnoozed ? 'Hide' : 'Show'} snoozed ({snoozedCount})
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {filteredRisks.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No actions required"
            description={
              totalCount === 0
                ? 'When there are compliance expirations, overdue rent, or maintenance issues, they\'ll appear here.'
                : snoozedCount > 0 && !showSnoozed
                  ? `${snoozedCount} snoozed action${snoozedCount > 1 ? 's' : ''} hidden. All other filters clear.`
                  : 'No results match your current filters.'
            }
            variant="success"
            action={
              (typeFilter !== 'all' || severityFilter !== 'all' || search)
                ? { label: 'Clear Filters', onClick: () => { setTypeFilter('all'); setSeverityFilter('all'); setSearch(''); } }
                : undefined
            }
          />
        ) : groupMode === 'property' ? (
          <div className="space-y-3">
            {groupedRisks.map(group => (
              <PropertyGroup
                key={group.propertyId || group.address}
                address={group.address}
                propertyId={group.propertyId}
                risks={group.risks}
                snoozes={snoozes}
                assignments={assignments}
                memberMap={memberMap}
                contractorMap={contractorMap}
                onResolve={handleResolve}
                onSnooze={handleSnooze}
                onUnsnooze={handleUnsnooze}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredRisks.map(risk => (
              <RiskRow
                key={risk.id}
                risk={risk}
                snoozeData={isSnoozed(risk.id, snoozes)}
                assignment={getAssignment(risk.id, assignments)}
                memberMap={memberMap}
                contractorMap={contractorMap}
                onResolve={handleResolve}
                onSnooze={handleSnooze}
                onUnsnooze={handleUnsnooze}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <ResolveActionDialog
        open={!!resolveRisk}
        onOpenChange={(open) => { if (!open) setResolveRisk(null); }}
        risk={resolveRisk}
      />
      <SnoozeActionDialog
        open={!!snoozeRisk}
        onOpenChange={(open) => { if (!open) setSnoozeRisk(null); }}
        risk={snoozeRisk}
      />
    </AppLayout>
  );
}
