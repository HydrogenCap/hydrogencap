import React, { useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  Banknote,
  BellOff,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
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
import { useToast } from '@/hooks/use-toast';
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
  const [showSnoozed, setShowSnoozed] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { isSnoozed, snoozeUntilTomorrow, unsnooze } = usePulseSnooze();
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

  const { history, delta } = usePulseHistory(pulseScore);

  // Build sparkline path
  const sparkPath = useMemo(() => {
    if (history.length < 2) return null;
    const w = 100;
    const h = 24;
    const xs = history.map((_, i) => (i / (history.length - 1)) * w);
    const ys = history.map((p) => h - (Math.max(0, Math.min(100, p.score)) / 100) * h);
    const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
    return { d, w, h, points: xs.map((x, i) => ({ x, y: ys[i] })) };
  }, [history]);

  // 7-day high/low
  const weekStats = useMemo(() => {
    const last7 = history.slice(-7);
    if (last7.length === 0) return null;
    const scores = last7.map((h) => h.score);
    return { high: Math.max(...scores), low: Math.min(...scores), n: last7.length };
  }, [history]);

  // Partition actions by snooze state
  const visibleActions = actions.filter((a) => !isSnoozed(a.id));
  const snoozedActions = actions.filter((a) => isSnoozed(a.id));
  const renderedActions = showSnoozed ? actions : visibleActions;
  const snoozedCount = snoozedActions.length;

  const deltaIcon = delta === null ? null : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : null;
  const deltaColor =
    delta === null || delta === 0
      ? 'text-muted-foreground'
      : delta > 0
        ? 'text-success'
        : 'text-destructive';

  const handleCopyBriefing = useCallback(async () => {
    const lines: string[] = [];
    lines.push(`Portfolio briefing — ${format(new Date(), 'EEE d MMM yyyy')}`);
    lines.push(`Pulse score: ${pulseScore}/100${delta !== null ? ` (${delta > 0 ? '+' : ''}${delta} vs yesterday)` : ''}`);
    lines.push('');
    lines.push(summary);
    lines.push('');
    const visible = actions.filter((a) => !isSnoozed(a.id));
    if (visible.length > 0) {
      lines.push('Actions:');
      visible.forEach((a, i) => {
        lines.push(`${i + 1}. [${a.severity.toUpperCase()}] ${a.title} — ${a.detail}`);
      });
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      toast({ title: 'Briefing copied', description: 'Paste into Slack, email, or your standup notes.' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Copy failed', description: 'Clipboard unavailable.', variant: 'destructive' });
    }
  }, [pulseScore, delta, summary, actions, isSnoozed, toast]);

  return (
    <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-muted/20">
      <CardContent className="p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-start gap-5">
          {/* Score ring + trend */}
          <div className="flex items-center gap-4 md:flex-col md:items-center md:gap-2 md:min-w-[140px]">
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

            {/* Sparkline + delta */}
            {sparkPath && (
              <div
                className="hidden md:flex flex-col items-center gap-1 mt-1"
                aria-label={`Pulse trend over ${history.length} days`}
                title={`${history.length}-day pulse trend`}
              >
                <svg
                  viewBox={`0 0 ${sparkPath.w} ${sparkPath.h}`}
                  className="w-[100px] h-6"
                  preserveAspectRatio="none"
                >
                  <path
                    d={sparkPath.d}
                    fill="none"
                    className={scoreRing}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle
                    cx={sparkPath.points[sparkPath.points.length - 1].x}
                    cy={sparkPath.points[sparkPath.points.length - 1].y}
                    r="1.8"
                    className={cn('fill-current', scoreColor)}
                  />
                </svg>
                {delta !== null && (
                  <div className={cn('flex items-center gap-0.5 text-[10px] font-medium tabular-nums', deltaColor)}>
                    {deltaIcon ? React.createElement(deltaIcon, { className: 'h-3 w-3' }) : null}
                    <span>{delta > 0 ? '+' : ''}{delta} vs yesterday</span>
                  </div>
                )}
                {weekStats && weekStats.n >= 2 && (
                  <div className="text-[10px] text-muted-foreground tabular-nums">
                    {weekStats.n}d hi {weekStats.high} · lo {weekStats.low}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="text-base md:text-lg font-semibold text-foreground">
                  Portfolio briefing
                </h2>
              </div>
              <div className="flex items-center gap-1">
                {snoozedCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px] gap-1 text-muted-foreground"
                    onClick={() => setShowSnoozed((v) => !v)}
                    aria-pressed={showSnoozed}
                  >
                    {showSnoozed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {showSnoozed ? 'Hide' : 'Show'} {snoozedCount} snoozed
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px] gap-1 text-muted-foreground"
                  onClick={handleCopyBriefing}
                  title="Copy briefing to clipboard"
                >
                  {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{summary}</p>

            {renderedActions.length === 0 && snoozedCount > 0 && !showSnoozed && (
              <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center">
                <BellOff className="h-5 w-5 mx-auto text-muted-foreground mb-1.5" />
                <p className="text-sm text-foreground">All actions snoozed until tomorrow</p>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 mt-1 text-xs"
                  onClick={() => setShowSnoozed(true)}
                >
                  Show {snoozedCount} snoozed item{snoozedCount === 1 ? '' : 's'}
                </Button>
              </div>
            )}

            <ul className="space-y-2">
              {renderedActions.map((a) => {
                const Icon = a.icon;
                const s = severityStyles[a.severity];
                const snoozedNow = isSnoozed(a.id);
                return (
                  <li key={a.id}>
                    <div
                      className={cn(
                        'group relative w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all',
                        'hover:shadow-sm focus-within:ring-2 focus-within:ring-ring',
                        s.ring,
                        snoozedNow && 'opacity-60',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => handleOpen(a.id)}
                        aria-label={`${a.title} — open details`}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left focus:outline-none"
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
                          <p className="text-xs text-muted-foreground truncate">
                            {snoozedNow ? `Snoozed · ${a.detail}` : a.detail}
                          </p>
                        </div>
                        <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground">
                          Details
                          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </button>
                      {a.id !== 'all-clear' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (snoozedNow) { unsnooze(a.id); } else { snoozeUntilTomorrow(a.id); }
                          }}
                          className={cn(
                            'ml-1 shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-md',
                            'text-muted-foreground hover:text-foreground hover:bg-muted',
                            'focus:outline-none focus:ring-2 focus:ring-ring',
                            'opacity-0 group-hover:opacity-100 focus:opacity-100',
                            snoozedNow && 'opacity-100',
                          )}
                          aria-label={snoozedNow ? 'Unsnooze action' : 'Snooze until tomorrow'}
                          title={snoozedNow ? 'Unsnooze' : 'Snooze until tomorrow'}
                        >
                          {snoozedNow ? <Undo2 className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
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
