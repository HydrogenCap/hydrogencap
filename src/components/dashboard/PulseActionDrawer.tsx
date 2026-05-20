import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, formatDistanceToNowStrict, differenceInDays } from 'date-fns';
import {
  ArrowRight,
  Banknote,
  CalendarClock,
  CheckCircle2,
  Filter,
  ShieldAlert,
  Sparkles,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatGBP } from '@/lib/calculations';

export type PulseActionId =
  | 'risks-critical'
  | 'rent-overdue'
  | 'loan-refi'
  | 'comp-upcoming'
  | 'all-clear';

interface PulseActionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionId: PulseActionId | null;
  data: {
    risks?: any[];
    criticalCount?: number;
    rentSchedule?: any[];
    loanAlerts?: any[];
    complianceEvents?: any[];
  };
}

interface Metric {
  label: string;
  value: string;
  tone?: 'default' | 'critical' | 'warning' | 'success';
}

interface DrawerConfig {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string; // tailwind text color
  accentBg: string; // tailwind bg color
  metrics: Metric[];
  items: Array<{
    primary: string;
    secondary?: string;
    badge?: { label: string; tone: 'critical' | 'warning' | 'info' | 'success' };
  }>;
  itemsTitle: string;
  emptyItems: string;
  filters: Array<{ label: string; href: string }>;
  guidance: string[];
  primaryCta: { label: string; href: string };
}

const toneClasses = {
  default: 'text-foreground',
  critical: 'text-destructive',
  warning: 'text-warning',
  success: 'text-success',
};

const badgeTone = {
  critical: 'bg-destructive/15 text-destructive border-destructive/30',
  warning: 'bg-warning/15 text-warning border-warning/30',
  info: 'bg-primary/10 text-primary border-primary/30',
  success: 'bg-success/15 text-success border-success/30',
};

function buildConfig(
  actionId: PulseActionId,
  data: PulseActionDrawerProps['data'],
): DrawerConfig | null {
  const now = new Date();

  switch (actionId) {
    case 'risks-critical': {
      const risks = (data.risks || []) as any[];
      const critical = risks.filter((r) => String(r?.severity ?? r?.level ?? '').toLowerCase() === 'critical');
      const high = risks.filter((r) => String(r?.severity ?? r?.level ?? '').toLowerCase() === 'high');
      const affectedProps = new Set(critical.map((r) => r?.property_id ?? r?.propertyId).filter(Boolean));
      const byCategory = new Map<string, number>();
      for (const r of critical) {
        const k = String(r?.category ?? r?.type ?? 'Other');
        byCategory.set(k, (byCategory.get(k) ?? 0) + 1);
      }
      const topCats = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

      return {
        title: 'Critical risks',
        description: 'Issues that materially affect compliance, safety, or income.',
        icon: ShieldAlert,
        accent: 'text-destructive',
        accentBg: 'bg-destructive/10',
        metrics: [
          { label: 'Critical', value: String(critical.length || data.criticalCount || 0), tone: 'critical' },
          { label: 'High', value: String(high.length), tone: 'warning' },
          { label: 'Affected properties', value: String(affectedProps.size) },
          { label: 'Total open', value: String(risks.length) },
        ],
        itemsTitle: 'Top critical items',
        emptyItems: 'No critical risk records were returned by the risks feed.',
        items: critical.slice(0, 6).map((r) => {
          const address = r?.address ?? r?.property_address ?? r?.propertyAddress ?? r?.property?.address_line;
          const title = String(r?.message ?? r?.title ?? r?.description ?? 'Untitled risk');
          return {
            primary: address ? String(address) : title,
            secondary: address
              ? [title, r?.category ?? r?.type].filter(Boolean).join(' · ')
              : (r?.category ?? r?.type) || undefined,
            badge: { label: 'Critical', tone: 'critical' },
          };
        }),
        filters: [
          { label: 'All risks', href: '/risks' },
          ...topCats.map(([cat, n]) => ({
            label: `${cat} (${n})`,
            href: `/risks?category=${encodeURIComponent(cat)}`,
          })),
        ],
        guidance: [
          'Triage by property: open each address and resolve the underlying compliance or safety document.',
          'Critical risks typically block lender packs and tenancy renewals — clear before month-end.',
          'Use the Compliance register to upload the missing certificate; risks auto-close on valid upload.',
        ],
        primaryCta: { label: 'Open Risks register', href: '/risks' },
      };
    }

    case 'rent-overdue': {
      const sched = (data.rentSchedule || []) as any[];
      const unpaid = sched.filter((r) =>
        ['overdue', 'unpaid', 'partial'].includes(String(r?.status || '').toLowerCase()),
      );
      const overdueAmount = unpaid.reduce(
        (s, r) => s + (Number(r?.expected_amount ?? r?.amount ?? 0) || 0),
        0,
      );
      const partial = unpaid.filter((r) => String(r?.status).toLowerCase() === 'partial');
      const fullyOverdue = unpaid.filter((r) => String(r?.status).toLowerCase() !== 'partial');
      const collected = sched.length - unpaid.length;
      const collectionRate = sched.length > 0 ? Math.round((collected / sched.length) * 100) : 0;

      return {
        title: 'Outstanding rent',
        description: `${format(now, 'MMMM yyyy')} collection status.`,
        icon: Banknote,
        accent: 'text-warning',
        accentBg: 'bg-warning/10',
        metrics: [
          { label: 'Outstanding', value: formatGBP(overdueAmount), tone: 'warning' },
          { label: 'Tenancies behind', value: String(unpaid.length), tone: unpaid.length >= 3 ? 'critical' : 'warning' },
          { label: 'Partial payments', value: String(partial.length) },
          { label: 'Collection rate', value: `${collectionRate}%`, tone: collectionRate >= 90 ? 'success' : 'warning' },
        ],
        itemsTitle: 'Behind on payment',
        emptyItems: 'No outstanding tenancies in the current schedule.',
        items: fullyOverdue.slice(0, 6).map((r) => ({
          primary: String(r?.tenant_name ?? r?.tenancy_name ?? r?.property_address ?? 'Tenancy'),
          secondary: [
            r?.property_address,
            r?.due_date ? `Due ${format(new Date(r.due_date), 'd MMM')}` : null,
          ]
            .filter(Boolean)
            .join(' · ') || undefined,
          badge: {
            label: formatGBP(Number(r?.expected_amount ?? r?.amount ?? 0)),
            tone: 'warning',
          },
        })),
        filters: [
          { label: 'Reconcile now', href: '/rent-reconciliation' },
          { label: 'Arrears report', href: '/rent-reconciliation?view=arrears' },
          { label: 'Rent schedule', href: '/rent-reconciliation?view=schedule' },
        ],
        guidance: [
          'Match recent bank statements first — many "unpaid" entries clear automatically once reconciled.',
          'For partials, confirm the shortfall reason and log an expected top-up date against the tenancy.',
          'If 7+ days overdue, send a rent reminder; at 14+ days consider a Section 8 / arrears letter from Templates.',
        ],
        primaryCta: { label: 'Go to Rent reconciliation', href: '/rent-reconciliation' },
      };
    }

    case 'loan-refi': {
      const loans = (data.loanAlerts || []) as any[];
      const dated = loans
        .map((l) => ({ ...l, _days: l?.maturity_date ? differenceInDays(new Date(l.maturity_date), now) : null }))
        .filter((l) => l._days !== null) as any[];
      const within90 = dated.filter((l) => l._days! <= 90 && l._days! >= 0);
      const within180 = dated.filter((l) => l._days! > 90 && l._days! <= 180);
      const expired = dated.filter((l) => l._days! < 0);
      const totalBalance = loans.reduce((s, l) => s + (Number(l?.current_balance ?? l?.balance ?? 0) || 0), 0);

      return {
        title: 'Loans approaching maturity',
        description: 'Plan refinances before the rate window closes.',
        icon: CalendarClock,
        accent: 'text-warning',
        accentBg: 'bg-warning/10',
        metrics: [
          { label: 'Within 90 days', value: String(within90.length), tone: within90.length > 0 ? 'warning' : 'default' },
          { label: '90–180 days', value: String(within180.length) },
          { label: 'Already expired', value: String(expired.length), tone: expired.length > 0 ? 'critical' : 'default' },
          { label: 'Total balance', value: formatGBP(totalBalance) },
        ],
        itemsTitle: 'Upcoming maturities',
        emptyItems: 'No active loan facilities returned by the alerts feed.',
        items: dated
          .sort((a, b) => (a._days ?? 0) - (b._days ?? 0))
          .slice(0, 6)
          .map((l) => ({
            primary: String(l?.lender_name ?? l?.facility_name ?? 'Loan facility'),
            secondary: [
              l?.property_address,
              l?.maturity_date ? `Matures ${format(new Date(l.maturity_date), 'd MMM yyyy')}` : null,
            ]
              .filter(Boolean)
              .join(' · ') || undefined,
            badge: {
              label: l._days! < 0
                ? `${Math.abs(l._days!)}d overdue`
                : `${l._days}d`,
              tone: l._days! < 0 ? 'critical' : l._days! <= 90 ? 'warning' : 'info',
            },
          })),
        filters: [
          { label: 'All facilities', href: '/lending' },
          { label: 'Maturity calendar', href: '/compliance?view=calendar&type=mortgages' },
          { label: 'Refinance pipeline', href: '/lending?view=pipeline' },
        ],
        guidance: [
          'Begin product searches 4–6 months before maturity to lock favourable rates.',
          'Re-run portfolio DSCR with the new product rate to confirm affordability before applying.',
          'If maturity is within 60 days, contact the existing lender for a product transfer to avoid SVR fallback.',
        ],
        primaryCta: { label: 'Open Lending', href: '/lending' },
      };
    }

    case 'comp-upcoming': {
      const events = (data.complianceEvents || []) as any[];
      const upcoming = events
        .map((e) => {
          const d = e?.due_date || e?.expiry_date || e?.date;
          return { ...e, _days: d ? differenceInDays(new Date(d), now) : null, _date: d ? new Date(d) : null };
        })
        .filter((e) => e._days !== null && e._days >= 0 && e._days <= 30) as any[];
      const within7 = upcoming.filter((e) => e._days! <= 7);
      const within14 = upcoming.filter((e) => e._days! > 7 && e._days! <= 14);
      const byType = new Map<string, number>();
      for (const e of upcoming) {
        const k = String(e?.compliance_type ?? e?.type ?? 'Certificate');
        byType.set(k, (byType.get(k) ?? 0) + 1);
      }
      const topTypes = [...byType.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

      return {
        title: 'Compliance due in 30 days',
        description: 'Renew before expiry to keep tenancies lawful.',
        icon: AlertTriangle,
        accent: 'text-warning',
        accentBg: 'bg-warning/10',
        metrics: [
          { label: 'Due ≤ 7 days', value: String(within7.length), tone: within7.length > 0 ? 'critical' : 'default' },
          { label: 'Due 8–14 days', value: String(within14.length), tone: within14.length > 0 ? 'warning' : 'default' },
          { label: 'Due 15–30 days', value: String(upcoming.length - within7.length - within14.length) },
          { label: 'Total in window', value: String(upcoming.length) },
        ],
        itemsTitle: 'Soonest expiries',
        emptyItems: 'No compliance events fall in the next 30 days.',
        items: upcoming
          .sort((a, b) => (a._days ?? 0) - (b._days ?? 0))
          .slice(0, 6)
          .map((e) => ({
            primary: String(e?.compliance_type ?? e?.type ?? 'Certificate'),
            secondary: [
              e?.property_address,
              e._date ? `Due ${formatDistanceToNowStrict(e._date, { addSuffix: true })}` : null,
            ]
              .filter(Boolean)
              .join(' · ') || undefined,
            badge: {
              label: `${e._days}d`,
              tone: e._days! <= 7 ? 'critical' : e._days! <= 14 ? 'warning' : 'info',
            },
          })),
        filters: [
          { label: 'Full register', href: '/compliance' },
          { label: 'Calendar view', href: '/compliance?view=calendar' },
          ...topTypes.map(([t, n]) => ({
            label: `${t} (${n})`,
            href: `/compliance?type=${encodeURIComponent(t)}`,
          })),
        ],
        guidance: [
          'Book contractors now for items inside 14 days — slot availability tightens at month-end.',
          'Upload renewed certificates to auto-close the corresponding risk and reset the next due date.',
          'Use the renewal pipeline to track ordered → scheduled → completed across the team.',
        ],
        primaryCta: { label: 'Open Compliance register', href: '/compliance' },
      };
    }

    case 'all-clear': {
      return {
        title: 'Portfolio is on track',
        description: 'No critical items today — a good window for strategic work.',
        icon: CheckCircle2,
        accent: 'text-success',
        accentBg: 'bg-success/10',
        metrics: [
          { label: 'Critical risks', value: '0', tone: 'success' },
          { label: 'Rent issues', value: '0', tone: 'success' },
          { label: 'Compliance ≤ 30d', value: '0', tone: 'success' },
          { label: 'Loan events', value: '0', tone: 'success' },
        ],
        itemsTitle: 'Suggested next steps',
        emptyItems: '',
        items: [
          { primary: 'Run a stress test', secondary: 'Model rate shocks against your portfolio LTV and DSCR.' },
          { primary: 'Review CapEx pipeline', secondary: 'Sequence works while income is stable.' },
          { primary: 'Refresh investor pack', secondary: 'Quiet weeks are ideal for fundraising prep.' },
        ],
        filters: [
          { label: 'Insights', href: '/insights' },
          { label: 'CapEx', href: '/capex' },
          { label: 'Reports', href: '/reports' },
        ],
        guidance: [
          'Schedule a quarterly portfolio review while operational load is light.',
          'Re-evaluate underperforming assets and refresh hold/sell stances.',
        ],
        primaryCta: { label: 'Open Insights', href: '/insights' },
      };
    }
  }

  return null;
}

export function PulseActionDrawer({ open, onOpenChange, actionId, data }: PulseActionDrawerProps) {
  const config = useMemo(() => (actionId ? buildConfig(actionId, data) : null), [actionId, data]);

  if (!config) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg" />
      </Sheet>
    );
  }

  const Icon = config.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-start gap-3">
            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', config.accentBg)}>
              <Icon className={cn('h-5 w-5', config.accent)} />
            </span>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-left text-lg">{config.title}</SheetTitle>
              <SheetDescription className="text-left">{config.description}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-5 space-y-6">
            {/* Metrics */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Underlying metrics
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {config.metrics.map((m) => (
                  <div
                    key={m.label}
                    className="rounded-lg border bg-muted/30 px-3 py-2"
                  >
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{m.label}</p>
                    <p className={cn('text-lg font-semibold tabular-nums mt-0.5', toneClasses[m.tone ?? 'default'])}>
                      {m.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Items */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {config.itemsTitle}
              </h3>
              {config.items.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">{config.emptyItems}</p>
              ) : (
                <ul className="space-y-1.5">
                  {config.items.map((it, idx) => (
                    <li
                      key={idx}
                      className="flex items-start justify-between gap-3 rounded-md border bg-card px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{it.primary}</p>
                        {it.secondary && (
                          <p className="text-xs text-muted-foreground truncate">{it.secondary}</p>
                        )}
                      </div>
                      {it.badge && (
                        <Badge variant="outline" className={cn('shrink-0 text-[10px]', badgeTone[it.badge.tone])}>
                          {it.badge.label}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Separator />

            {/* Linked filters */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Filter className="h-3 w-3" /> Jump with filter
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {config.filters.map((f) => (
                  <Button
                    key={f.label}
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => onOpenChange(false)}
                  >
                    <Link to={f.href}>
                      {f.label}
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Guidance */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" /> Next-step guidance
              </h3>
              <ul className="space-y-2">
                {config.guidance.map((g, i) => (
                  <li key={i} className="flex gap-2 text-sm text-foreground/90">
                    <span
                      className={cn(
                        'mt-1.5 h-1.5 w-1.5 rounded-full shrink-0',
                        config.accent.replace('text-', 'bg-'),
                      )}
                    />
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="px-6 py-4 border-t bg-muted/20">
          <Button asChild className="w-full" onClick={() => onOpenChange(false)}>
            <Link to={config.primaryCta.href} className="flex items-center justify-center gap-2">
              {config.primaryCta.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
