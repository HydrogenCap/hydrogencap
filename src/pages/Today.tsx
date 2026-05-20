import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageSkeleton, EmptyState } from '@/components/common';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePortfolioRisks, type RiskItem } from '@/hooks/usePortfolioRisks';
import { useTenancyEvents } from '@/hooks/useTenancyEvents';
import { useTasks } from '@/hooks/useTasks';
import { useArrearsPredictions } from '@/hooks/useArrearsPredictions';
import { useRecentActivity } from '@/hooks/useAuditLog';
import { useSnoozedItems } from '@/hooks/useSnoozedItems';
import {
  AlertTriangle, CalendarClock, PoundSterling, ClipboardList, Activity,
  Clock, ArrowRight, BellOff,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

type Severity = 'critical' | 'warning' | 'info';

interface TodayItem {
  key: string;
  title: string;
  subtitle?: string;
  url: string;
  severity: Severity;
  meta?: string;
}

function SeverityDot({ severity }: { severity: Severity }) {
  const cls =
    severity === 'critical' ? 'bg-destructive' :
    severity === 'warning' ? 'bg-amber-500' : 'bg-muted-foreground';
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} aria-hidden />;
}

function Section({
  icon: Icon, title, description, items, viewAllHref, viewAllLabel,
  snooze, isSnoozed,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  items: TodayItem[];
  viewAllHref?: string;
  viewAllLabel?: string;
  snooze: (k: string, days?: number) => void;
  isSnoozed: (k: string) => boolean;
}) {
  const visible = items.filter((i) => !isSnoozed(i.key)).slice(0, 6);
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-4 w-4 text-muted-foreground" />
            {title}
            {visible.length > 0 && (
              <Badge variant="secondary" className="ml-1">{visible.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {viewAllHref && (
          <Button asChild variant="ghost" size="sm" className="-mr-2 text-xs">
            <Link to={viewAllHref}>{viewAllLabel ?? 'View all'} <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nothing here. Good work.</p>
        ) : (
          <ul className="divide-y divide-border -mx-6">
            {visible.map((item) => (
              <li key={item.key} className="flex items-start gap-3 px-6 py-3 group hover:bg-muted/40 transition-colors">
                <SeverityDot severity={item.severity} />
                <Link to={item.url} className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  {item.subtitle && (
                    <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                  )}
                </Link>
                {item.meta && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{item.meta}</span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.preventDefault(); snooze(item.key, 7); }}
                  aria-label="Snooze for 7 days"
                  title="Snooze for 7 days"
                >
                  <BellOff className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function riskSeverity(r: RiskItem): Severity {
  return r.severity === 'critical' ? 'critical' : 'warning';
}

function formatDays(days: number | undefined): string {
  if (days === undefined) return '';
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days <= 30) return `in ${days}d`;
  return `in ${Math.round(days / 30)}mo`;
}

const AUDIT_TABLE_LABELS: Record<string, string> = {
  properties_v2: 'Property',
  tenants_v2: 'Tenant',
  tenancy_agreements: 'Tenancy',
  compliance_documents_v2: 'Compliance doc',
  compliance_matrix_v2: 'Compliance',
  loan_facilities: 'Loan',
  legal_entities: 'Entity',
  rent_payments: 'Rent payment',
  work_orders: 'Work order',
  insurance_policies: 'Insurance',
  capex_projects: 'CapEx',
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  INSERT: 'created',
  UPDATE: 'updated',
  DELETE: 'deleted',
};

export default function Today() {
  usePageTitle('Today');
  const { isSnoozed, snooze, snoozedCount } = useSnoozedItems();

  const { risks, isLoading: risksLoading } = usePortfolioRisks();
  const { data: tenancyEvents, isLoading: eventsLoading } = useTenancyEvents({ daysAhead: 30 });
  const { data: tasks, isLoading: tasksLoading } = useTasks();
  const { data: arrears, isLoading: arrearsLoading } = useArrearsPredictions();
  const { data: recentActivity, isLoading: activityLoading } = useRecentActivity(8);

  const isLoading = risksLoading || eventsLoading || tasksLoading || arrearsLoading || activityLoading;

  // OVERDUE & DUE SOON — compliance/risk items
  const overdueItems: TodayItem[] = useMemo(() => {
    if (!risks) return [];
    return risks
      .filter((r) => r.daysUntilDeadline === undefined || r.daysUntilDeadline <= 30)
      .slice(0, 10)
      .map((r) => ({
        key: `risk:${r.id}`,
        title: r.message,
        subtitle: r.address,
        url: r.targetUrl,
        severity: riskSeverity(r),
        meta: formatDays(r.daysUntilDeadline),
      }));
  }, [risks]);

  // TENANCY EVENTS — upcoming rent reviews / break clauses / end dates
  const tenancyItems: TodayItem[] = useMemo(() => {
    if (!tenancyEvents) return [];
    return tenancyEvents
      .filter((e) => e.daysUntil <= 30)
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 10)
      .map((e) => ({
        key: `tenancy:${e.tenancyId}:${e.type}`,
        title: e.title,
        subtitle: `${e.tenantName} · ${e.propertyAddress}`,
        url: `/properties-v2/${e.propertyId}`,
        severity: e.status === 'overdue' ? 'critical' : e.status === 'action_required' ? 'warning' : 'info',
        meta: formatDays(e.daysUntil),
      }));
  }, [tenancyEvents]);

  // OPEN TASKS
  const taskItems: TodayItem[] = useMemo(() => {
    if (!tasks) return [];
    return tasks
      .filter((t) => t.status === 'open' || t.status === 'in_progress')
      .slice(0, 10)
      .map((t) => {
        const days = t.due_date
          ? Math.ceil((new Date(t.due_date).getTime() - Date.now()) / 86_400_000)
          : undefined;
        return {
          key: `task:${t.id}`,
          title: t.title,
          subtitle: t.category,
          url: t.property_id ? `/properties-v2/${t.property_id}` : '/compliance-tasks',
          severity: (days !== undefined && days < 0) || t.priority === 'urgent' ? 'critical'
                  : t.priority === 'high' ? 'warning' : 'info',
          meta: days !== undefined ? formatDays(days) : undefined,
        };
      });
  }, [tasks]);

  // ARREARS — top risk tenants
  const arrearsItems: TodayItem[] = useMemo(() => {
    if (!arrears) return [];
    return arrears
      .filter((a) => a.risk_level === 'critical' || a.risk_level === 'high')
      .slice(0, 5)
      .map((a) => ({
        key: `arrears:${a.id}`,
        title: `Risk score ${Math.round(a.risk_score)} — ${a.risk_level}`,
        subtitle: a.tenant_id ? `Tenant ${a.tenant_id.slice(0, 8)}` : `Property ${a.property_id.slice(0, 8)}`,
        url: a.tenant_id ? `/tenants-v2/${a.tenant_id}` : `/properties-v2/${a.property_id}`,
        severity: a.risk_level === 'critical' ? 'critical' : 'warning',
      }));
  }, [arrears]);

  // RECENT ACTIVITY
  const activityItems: TodayItem[] = useMemo(() => {
    if (!recentActivity) return [];
    return recentActivity.slice(0, 8).map((a) => {
      const label = AUDIT_TABLE_LABELS[a.table_name] ?? a.table_name;
      const action = AUDIT_ACTION_LABELS[a.action] ?? a.action.toLowerCase();
      return {
        key: `audit:${a.id}`,
        title: `${label} ${action}`,
        subtitle: Array.isArray(a.changed_fields) && a.changed_fields.length
          ? a.changed_fields.slice(0, 3).join(', ')
          : undefined,
        url: '/audit-log',
        severity: 'info' as Severity,
        meta: a.changed_at ? formatDistanceToNow(new Date(a.changed_at), { addSuffix: true }) : undefined,
      };
    });
  }, [recentActivity]);

  if (isLoading) {
    return <AppLayout><PageSkeleton tabs={0} /></AppLayout>;
  }

  const totalActionable =
    overdueItems.length + tenancyItems.length + taskItems.length + arrearsItems.length;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl">
        <header className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl tracking-tight" style={{ fontFamily: 'DM Serif Display, serif' }}>
              Today
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Everything that needs your attention in one place.
              {snoozedCount > 0 && (
                <span className="ml-2 text-xs">· {snoozedCount} snoozed</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={totalActionable > 0 ? 'destructive' : 'secondary'} className="text-sm px-3 py-1">
              {totalActionable} actionable
            </Badge>
            <Button asChild variant="outline" size="sm">
              <Link to="/fix-it">Fix-it queue</Link>
            </Button>
          </div>
        </header>

        {totalActionable === 0 && activityItems.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="All clear"
            description="No overdue items, upcoming deadlines or open tasks. Enjoy the calm."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <Section
              icon={AlertTriangle}
              title="Overdue & due in 30 days"
              description="Compliance, valuations, rates and HMO items needing attention."
              items={overdueItems}
              viewAllHref="/actions"
              snooze={snooze}
              isSnoozed={isSnoozed}
            />
            <Section
              icon={CalendarClock}
              title="Tenancy events"
              description="Rent reviews, break clauses, ends and voids in the next 30 days."
              items={tenancyItems}
              viewAllHref="/tenants-v2"
              snooze={snooze}
              isSnoozed={isSnoozed}
            />
            <Section
              icon={ClipboardList}
              title="Open tasks"
              description="Assigned tasks across compliance, lettings and operations."
              items={taskItems}
              viewAllHref="/compliance-tasks"
              snooze={snooze}
              isSnoozed={isSnoozed}
            />
            <Section
              icon={PoundSterling}
              title="Arrears risk"
              description="Tenants with the highest predicted arrears risk."
              items={arrearsItems}
              viewAllHref="/rent"
              snooze={snooze}
              isSnoozed={isSnoozed}
            />
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    Recent activity
                  </CardTitle>
                  <CardDescription>What changed across your portfolio recently.</CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm" className="-mr-2 text-xs">
                  <Link to="/audit-log">View audit log <ArrowRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {activityItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No recent activity.</p>
                ) : (
                  <ul className="divide-y divide-border -mx-6">
                    {activityItems.map((a) => (
                      <li key={a.key} className="flex items-start gap-3 px-6 py-3">
                        <SeverityDot severity="info" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{a.title}</p>
                          {a.subtitle && (
                            <p className="text-xs text-muted-foreground truncate">{a.subtitle}</p>
                          )}
                        </div>
                        {a.meta && <span className="text-xs text-muted-foreground whitespace-nowrap">{a.meta}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
