import React, { useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  Banknote,
  BellOff,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  EyeOff,
  Eye,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Undo2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatGBP } from '@/lib/calculations';
import { PulseActionDrawer, type PulseActionId } from './PulseActionDrawer';
import { usePulseHistory, usePulseSnooze } from './usePulsePersistence';

type Severity = 'critical' | 'warning' | 'info' | 'success';

interface PulseAction {
  id: string;
  severity: Severity;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  detail: string;
  href: string;
  cta: string;
}

interface PortfolioPulseProps {
  risks: any[] | undefined;
  criticalCount: number;
  loanAlerts: any[] | undefined;
  rentSchedule: any[] | undefined;
  complianceEvents: any[] | undefined;
  propertiesCount: number;
}

const severityStyles: Record<Severity, { dot: string; ring: string; pill: string }> = {
  critical: {
    dot: 'bg-destructive',
    ring: 'border-destructive/40 bg-destructive/5',
    pill: 'bg-destructive/15 text-destructive',
  },
  warning: {
    dot: 'bg-warning',
    ring: 'border-warning/40 bg-warning/5',
    pill: 'bg-warning/15 text-warning',
  },
  info: {
    dot: 'bg-primary',
    ring: 'border-primary/30 bg-primary/5',
    pill: 'bg-primary/10 text-primary',
  },
  success: {
    dot: 'bg-success',
    ring: 'border-success/30 bg-success/5',
    pill: 'bg-success/15 text-success',
  },
};

export function PortfolioPulse({
  risks,
  criticalCount,
  loanAlerts,
  rentSchedule,
  complianceEvents,
  propertiesCount,
}: PortfolioPulseProps) {
  const [openAction, setOpenAction] = useState<PulseActionId | null>(null);
  const handleOpen = useCallback((id: string) => setOpenAction(id as PulseActionId), []);
  const { actions, summary, pulseScore } = useMemo(() => {
    const acts: PulseAction[] = [];
    const now = new Date();

    // Critical risks
    if (criticalCount > 0) {
      acts.push({
        id: 'risks-critical',
        severity: 'critical',
        icon: ShieldAlert,
        title: `${criticalCount} critical risk${criticalCount === 1 ? '' : 's'} need attention`,
        detail: 'Resolve to protect portfolio compliance posture.',
        href: '/risks',
        cta: 'Review risks',
      });
    }

    // Rent — overdue / unpaid
    const unpaid = (rentSchedule || []).filter(
      (r: any) => r?.status && ['overdue', 'unpaid', 'partial'].includes(String(r.status).toLowerCase()),
    );
    const overdueAmount = unpaid.reduce(
      (s: number, r: any) => s + (Number(r?.expected_amount ?? r?.amount ?? 0) || 0),
      0,
    );
    if (unpaid.length > 0) {
      acts.push({
        id: 'rent-overdue',
        severity: unpaid.length >= 3 ? 'critical' : 'warning',
        icon: Banknote,
        title: `${unpaid.length} rent payment${unpaid.length === 1 ? '' : 's'} outstanding`,
        detail: overdueAmount > 0 ? `${formatGBP(overdueAmount)} expected this month.` : 'Chase tenants or reconcile.',
        href: '/rent-reconciliation',
        cta: 'Reconcile rent',
      });
    }

    // Loan alerts — refinancing windows
    const loans = (loanAlerts || []).slice(0, 5);
    if (loans.length > 0) {
      const soonest = loans
        .map((l: any) => l?.maturity_date)
        .filter(Boolean)
        .map((d: string) => differenceInDays(new Date(d), now))
        .sort((a, b) => a - b)[0];
      acts.push({
        id: 'loan-refi',
        severity: soonest !== undefined && soonest <= 90 ? 'warning' : 'info',
        icon: CalendarClock,
        title: `${loans.length} loan${loans.length === 1 ? '' : 's'} approaching maturity`,
        detail:
          soonest !== undefined
            ? `Next within ${Math.max(0, soonest)} day${soonest === 1 ? '' : 's'}.`
            : 'Plan refinance strategy ahead of expiry.',
        href: '/lending',
        cta: 'Open lending',
      });
    }

    // Compliance — upcoming/expiring
    const compUpcoming = (complianceEvents || []).filter((e: any) => {
      const d = e?.due_date || e?.expiry_date || e?.date;
      if (!d) return false;
      const days = differenceInDays(new Date(d), now);
      return days >= 0 && days <= 30;
    });
    if (compUpcoming.length > 0) {
      acts.push({
        id: 'comp-upcoming',
        severity: compUpcoming.length >= 5 ? 'warning' : 'info',
        icon: AlertTriangle,
        title: `${compUpcoming.length} compliance item${compUpcoming.length === 1 ? '' : 's'} due in 30 days`,
        detail: 'Renew certificates before tenancies are affected.',
        href: '/compliance',
        cta: 'Open compliance',
      });
    }

    // Sort by severity
    const order: Record<Severity, number> = { critical: 0, warning: 1, info: 2, success: 3 };
    acts.sort((a, b) => order[a.severity] - order[b.severity]);

    // Pulse score (0-100) — start at 100, deduct for issues
    let score = 100;
    score -= Math.min(40, criticalCount * 12);
    score -= Math.min(20, unpaid.length * 6);
    score -= Math.min(15, compUpcoming.length * 2);
    score -= Math.min(10, loans.length * 2);
    score = Math.max(0, Math.min(100, score));

    let sum = '';
    if (acts.length === 0) {
      sum = `All clear across ${propertiesCount} ${propertiesCount === 1 ? 'property' : 'properties'} — no urgent items today.`;
      acts.push({
        id: 'all-clear',
        severity: 'success',
        icon: CheckCircle2,
        title: 'Portfolio is on track',
        detail: 'No critical items. Use the quiet to plan acquisitions or refinances.',
        href: '/insights',
        cta: 'Explore insights',
      });
    } else {
      const segs: string[] = [];
      if (criticalCount > 0) segs.push(`${criticalCount} critical risk${criticalCount === 1 ? '' : 's'}`);
      if (unpaid.length > 0) segs.push(`${unpaid.length} rent issue${unpaid.length === 1 ? '' : 's'}`);
      if (compUpcoming.length > 0) segs.push(`${compUpcoming.length} compliance deadline${compUpcoming.length === 1 ? '' : 's'}`);
      if (loans.length > 0) segs.push(`${loans.length} loan event${loans.length === 1 ? '' : 's'}`);
      sum = `${segs.slice(0, 3).join(' · ')}${segs.length > 3 ? ` · +${segs.length - 3} more` : ''}.`;
    }

    return { actions: acts.slice(0, 5), summary: sum, pulseScore: score };
  }, [risks, criticalCount, loanAlerts, rentSchedule, complianceEvents, propertiesCount]);

  const scoreColor =
    pulseScore >= 85 ? 'text-success' : pulseScore >= 60 ? 'text-warning' : 'text-destructive';
  const scoreRing =
    pulseScore >= 85 ? 'stroke-success' : pulseScore >= 60 ? 'stroke-warning' : 'stroke-destructive';
  const circumference = 2 * Math.PI * 26;
  const dash = (pulseScore / 100) * circumference;

  return (
    <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-muted/20">
      <CardContent className="p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-start gap-5">
          {/* Score ring */}
          <div className="flex items-center gap-4 md:flex-col md:items-center md:gap-2 md:min-w-[120px]">
            <div className="relative h-[72px] w-[72px]">
              <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
                <circle cx="32" cy="32" r="26" fill="none" className="stroke-muted" strokeWidth="6" />
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  fill="none"
                  className={cn(scoreRing, 'transition-[stroke-dasharray] duration-700')}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${circumference}`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn('text-xl font-bold tabular-nums', scoreColor)}>{pulseScore}</span>
              </div>
            </div>
            <div className="md:text-center">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Activity className="h-3 w-3" /> Pulse
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {format(new Date(), 'EEE d MMM')}
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-base md:text-lg font-semibold text-foreground">
                Portfolio briefing
              </h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{summary}</p>

            <ul className="space-y-2">
              {actions.map((a) => {
                const Icon = a.icon;
                const s = severityStyles[a.severity];
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => handleOpen(a.id)}
                      aria-label={`${a.title} — open details`}
                      className={cn(
                        'group w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all text-left',
                        'hover:shadow-sm hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        s.ring,
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                          s.pill,
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{a.detail}</p>
                      </div>
                      <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground">
                        Details
                        <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                      <span className={cn('h-1.5 w-1.5 rounded-full sm:hidden', s.dot)} />
                    </button>
                  </li>
                );
              })}
            </ul>

            {actions.length > 0 && actions[0].id !== 'all-clear' && (
              <div className="mt-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>Click any item for metrics, filters & next steps</span>
                <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                  <Link to="/insights">View full insights →</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>

      <PulseActionDrawer
        open={openAction !== null}
        onOpenChange={(o) => !o && setOpenAction(null)}
        actionId={openAction}
        data={{ risks, criticalCount, rentSchedule, loanAlerts, complianceEvents }}
      />
    </Card>
  );
}
