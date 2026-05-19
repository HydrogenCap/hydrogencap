import { useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Filter,
  RefreshCw,
  Scale,
  Shield,
  X,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SEVERITY, TEXT } from '@/lib/design-tokens';
import {
  useRegulatoryAlerts,
  useAcknowledgeAlert,
  useDismissAlert,
  useCheckRegChanges,
} from '@/hooks/useRegulatoryAlerts';
import type { RegulatoryAlert } from '@/hooks/useRegulatoryAlerts';

const CATEGORY_LABELS: Record<string, string> = {
  housing_act: 'Housing Act',
  hmo_regs: 'HMO Regulations',
  fire_safety: 'Fire Safety',
  epc_regs: 'EPC Regulations',
  tenancy_law: 'Tenancy Law',
  tax_changes: 'Tax Changes',
  licensing: 'Licensing',
  planning: 'Planning',
  other: 'Other',
};

const SEVERITY_ICON: Record<string, typeof AlertTriangle> = {
  critical: AlertTriangle,
  warning: AlertTriangle,
  info: Bell,
};

function SeverityBadge({ severity }: { severity: string }) {
  const sev = severity as keyof typeof SEVERITY;
  const tokens = SEVERITY[sev] || SEVERITY.info;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tokens.badge}`}>
      {severity}
    </span>
  );
}

function CategoryTag({ category }: { category: string }) {
  return (
    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
      {CATEGORY_LABELS[category] || category}
    </span>
  );
}

function AlertCard({ alert }: { alert: RegulatoryAlert }) {
  const [expanded, setExpanded] = useState(false);
  const acknowledge = useAcknowledgeAlert();
  const dismiss = useDismissAlert();

  const sev = alert.severity as keyof typeof SEVERITY;
  const tokens = SEVERITY[sev] || SEVERITY.info;
  const Icon = SEVERITY_ICON[alert.severity] || Bell;
  const actions = Array.isArray(alert.recommended_actions) ? alert.recommended_actions : [];

  return (
    <Card className={`border ${tokens.border} ${alert.dismissed ? 'opacity-60' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`rounded-full p-1.5 ${tokens.bg} shrink-0 mt-0.5`}>
            <Icon className={`h-4 w-4 ${tokens.text}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className={`${TEXT.cardTitle} ${tokens.text}`}>{alert.title}</h3>
              <SeverityBadge severity={alert.severity} />
              <CategoryTag category={alert.category} />
            </div>

            <p className="text-sm text-muted-foreground">{alert.summary}</p>

            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
              {alert.effective_date && (
                <span>Effective: {new Date(alert.effective_date).toLocaleDateString('en-GB')}</span>
              )}
              {alert.affects_property_types && alert.affects_property_types.length > 0 && (
                <span>Affects: {alert.affects_property_types.join(', ')}</span>
              )}
              {alert.acknowledged_at && (
                <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                  <Check className="h-3 w-3" /> Acknowledged
                </span>
              )}
            </div>

            {expanded && (
              <div className="mt-3 space-y-3">
                {alert.details && (
                  <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
                    {alert.details}
                  </div>
                )}
                {alert.source_url && (
                  <a
                    href={alert.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Source
                  </a>
                )}
                {actions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-1">Recommended Actions:</p>
                    <ul className="space-y-1">
                      {(actions as string[]).map((action, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0" />
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            {!alert.acknowledged_at && !alert.dismissed && (
              <Button variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => acknowledge.mutate(alert.id)}
                disabled={acknowledge.isPending}
                aria-label="Acknowledge"
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
            {!alert.dismissed && (
              <Button variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => dismiss.mutate(alert.id)}
                disabled={dismiss.isPending}
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineItem({ alert }: { alert: RegulatoryAlert }) {
  const sev = alert.severity as keyof typeof SEVERITY;
  const tokens = SEVERITY[sev] || SEVERITY.info;
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`h-3 w-3 rounded-full ${tokens.dot} shrink-0 mt-1`} />
        <div className="w-px flex-1 bg-border" />
      </div>
      <div className="pb-6 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium">{alert.title}</span>
          <SeverityBadge severity={alert.severity} />
        </div>
        <p className="text-xs text-muted-foreground">{alert.summary}</p>
        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
          {alert.effective_date && (
            <span>Effective: {new Date(alert.effective_date).toLocaleDateString('en-GB')}</span>
          )}
          <span>{CATEGORY_LABELS[alert.category] || alert.category}</span>
        </div>
      </div>
    </div>
  );
}

function RegulatoryMonitor() {
  const { data: alerts, isLoading } = useRegulatoryAlerts();
  const checkRegChanges = useCheckRegChanges();

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [view, setView] = useState<'list' | 'timeline'>('list');

  const filtered = (alerts || []).filter((alert) => {
    if (categoryFilter !== 'all' && alert.category !== categoryFilter) return false;
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
    if (statusFilter === 'active' && alert.dismissed) return false;
    if (statusFilter === 'acknowledged' && !alert.acknowledged_at) return false;
    if (statusFilter === 'dismissed' && !alert.dismissed) return false;
    return true;
  });

  const criticalCount = (alerts || []).filter((a) => a.severity === 'critical' && !a.dismissed).length;
  const warningCount = (alerts || []).filter((a) => a.severity === 'warning' && !a.dismissed).length;
  const acknowledgedCount = (alerts || []).filter((a) => a.acknowledged_at && !a.dismissed).length;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Scale className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className={TEXT.pageTitle}>Regulatory Monitor</h1>
              <p className="text-sm text-muted-foreground">
                AI-powered scanning of UK housing law changes and compliance deadlines
              </p>
            </div>
          </div>
          <Button
            onClick={() => checkRegChanges.mutate()}
            disabled={checkRegChanges.isPending}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${checkRegChanges.isPending ? 'animate-spin' : ''}`} />
            Check for Updates
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-full p-2 bg-red-500/10">
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
              <div>
                {isLoading ? (
                  <Skeleton className="h-6 w-8" />
                ) : (
                  <p className="text-xl font-bold">{criticalCount}</p>
                )}
                <p className="text-xs text-muted-foreground">Critical</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-full p-2 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                {isLoading ? (
                  <Skeleton className="h-6 w-8" />
                ) : (
                  <p className="text-xl font-bold">{warningCount}</p>
                )}
                <p className="text-xs text-muted-foreground">Warnings</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-full p-2 bg-green-500/10">
                <Check className="h-4 w-4 text-green-500" />
              </div>
              <div>
                {isLoading ? (
                  <Skeleton className="h-6 w-8" />
                ) : (
                  <p className="text-xl font-bold">{acknowledgedCount}</p>
                )}
                <p className="text-xs text-muted-foreground">Acknowledged</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-full p-2 bg-blue-500/10">
                <Shield className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                {isLoading ? (
                  <Skeleton className="h-6 w-8" />
                ) : (
                  <p className="text-xl font-bold">{(alerts || []).length}</p>
                )}
                <p className="text-xs text-muted-foreground">Total Alerts</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto flex gap-1">
            <Button
              variant={view === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('list')}
            >
              List
            </Button>
            <Button
              variant={view === 'timeline' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('timeline')}
            >
              Timeline
            </Button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Shield className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-sm font-medium">No alerts found</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {(alerts || []).length === 0
                  ? 'Click "Check for Updates" to scan for regulatory changes'
                  : 'Try adjusting your filters'}
              </p>
            </CardContent>
          </Card>
        ) : view === 'list' ? (
          <div className="space-y-3">
            {filtered.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className={TEXT.sectionHeading}>Regulatory Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="ml-1">
                {filtered.map((alert) => (
                  <TimelineItem key={alert.id} alert={alert} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

export default RegulatoryMonitor;
