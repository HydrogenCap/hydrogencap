import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common';
import { SEO } from '@/components/SEO';
import { ComplianceHubTabs } from '@/components/compliance/ComplianceHubTabs';
import { useComplianceMatrix, usePortfolioComplianceScoreV2 } from '@/hooks/useComplianceV2';
import { useSnoozedItems } from '@/hooks/useSnoozedItems';
import { DOC_TYPE_DISPLAY_NAMES } from '@/lib/complianceV2Types';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Search,
  ArrowRight,
  Upload,
  BellOff,
  CalendarClock,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Status = 'critical' | 'expired' | 'missing' | 'expiring_soon';

const STATUS_META: Record<Status, { label: string; rank: number; tone: 'destructive' | 'warning'; weight: number }> = {
  expired: { label: 'Expired', rank: 4, tone: 'destructive', weight: 1000 },
  critical: { label: 'Critical', rank: 3, tone: 'destructive', weight: 750 },
  missing: { label: 'Missing', rank: 2, tone: 'warning', weight: 500 },
  expiring_soon: { label: 'Expiring', rank: 1, tone: 'warning', weight: 250 },
};

const WINDOW_OPTIONS = [
  { id: '14', label: 'Next 14 days', days: 14 },
  { id: '30', label: 'Next 30 days', days: 30 },
  { id: '60', label: 'Next 60 days', days: 60 },
  { id: 'all', label: 'Everything overdue', days: 36500 },
] as const;
type WindowId = (typeof WINDOW_OPTIONS)[number]['id'];

function relativeDays(days: number | null): string {
  if (days === null) return '';
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'due today';
  if (days === 1) return 'due tomorrow';
  return `${days}d remaining`;
}

/**
 * Compliance Hub — the "Today" landing page.
 *
 * One prioritised list of every cert that needs action, grouped by property
 * and sortable by risk-weighted urgency. Designed to be the first stop for a
 * portfolio landlord opening the platform in the morning.
 */
export default function ComplianceHub() {
  usePageTitle('Compliance');
  const { data: matrix, isLoading } = useComplianceMatrix();
  const { data: score } = usePortfolioComplianceScoreV2();
  const { isSnoozed, snooze, snoozedCount } = useSnoozedItems();
  const [search, setSearch] = useState('');
  const [windowId, setWindowId] = useState<WindowId>('30');
  const [showSnoozed, setShowSnoozed] = useState(false);

  const windowDef = WINDOW_OPTIONS.find((w) => w.id === windowId)!;

  const items = useMemo(() => {
    if (!matrix) return [];
    const ATT: Status[] = ['expired', 'critical', 'missing', 'expiring_soon'];
    return matrix
      .filter((r) => {
        if (!r.is_required) return false;
        if (!ATT.includes(r.calculated_status as Status)) return false;
        // Window: keep anything overdue (days<=0) always, otherwise within window
        const dr = r.days_remaining;
        if (windowId !== 'all') {
          if (dr !== null && dr > windowDef.days) return false;
        }
        if (!showSnoozed && isSnoozed(`compliance:${r.requirement_id}`)) return false;
        if (search) {
          const q = search.toLowerCase();
          const hay = `${r.property_address || ''} ${DOC_TYPE_DISPLAY_NAMES[r.document_type] || r.document_type || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Risk-weighted urgency: status weight + overdue penalty
        const wa = STATUS_META[a.calculated_status as Status].weight + Math.max(0, -(a.days_remaining ?? 0)) * 5;
        const wb = STATUS_META[b.calculated_status as Status].weight + Math.max(0, -(b.days_remaining ?? 0)) * 5;
        if (wa !== wb) return wb - wa;
        return (a.days_remaining ?? 9999) - (b.days_remaining ?? 9999);
      });
  }, [matrix, windowDef.days, windowId, isSnoozed, showSnoozed, search]);

  // Group by property
  const grouped = useMemo(() => {
    const map = new Map<string, { address: string; propertyId: string; rows: typeof items }>();
    for (const r of items) {
      const key = r.property_id || 'unknown';
      if (!map.has(key)) {
        map.set(key, { address: r.property_address || 'Unknown property', propertyId: r.property_id || '', rows: [] });
      }
      map.get(key)!.rows.push(r);
    }
    return Array.from(map.values()).sort((a, b) => {
      // Sort properties by worst item
      const worstA = a.rows[0];
      const worstB = b.rows[0];
      const wa = STATUS_META[worstA.calculated_status as Status].weight;
      const wb = STATUS_META[worstB.calculated_status as Status].weight;
      return wb - wa;
    });
  }, [items]);

  const counts = useMemo(() => {
    const c = { critical: 0, expired: 0, missing: 0, expiring_soon: 0 };
    for (const r of items) c[r.calculated_status as Status]++;
    return c;
  }, [items]);

  const nextExpiry = useMemo(() => {
    if (!matrix) return null;
    return (
      matrix
        .filter((r) => r.is_required && r.days_remaining !== null && r.days_remaining > 0)
        .sort((a, b) => (a.days_remaining || 9999) - (b.days_remaining || 9999))[0] || null
    );
  }, [matrix]);

  return (
    <AppLayout>
      <SEO title="Compliance — TenureIQ" description="What needs action across your portfolio today." />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-6 w-6" />
              Compliance
            </h1>
            <p className="text-muted-foreground text-sm">
              What needs your attention across the portfolio.
            </p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <Button asChild variant="outline" size="sm">
              <Link to="/inbox">
                <Upload className="h-4 w-4 mr-2" />
                Upload certificates
              </Link>
            </Button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Compliance score"
            value={`${score?.compliance_score_pct ?? 0}%`}
            tone={
              (score?.compliance_score_pct ?? 0) === 100
                ? 'success'
                : (score?.compliance_score_pct ?? 0) >= 90
                  ? 'warning'
                  : 'destructive'
            }
            hint={`${score?.total_valid ?? 0} of ${score?.total_required ?? 0} valid`}
            loading={isLoading}
          />
          <KpiCard
            label="Needs attention"
            value={String(counts.critical + counts.expired + counts.missing + counts.expiring_soon)}
            tone={
              counts.expired + counts.critical > 0
                ? 'destructive'
                : counts.missing + counts.expiring_soon > 0
                  ? 'warning'
                  : 'success'
            }
            hint={`${counts.expired} expired · ${counts.missing} missing · ${counts.expiring_soon} expiring`}
            loading={isLoading}
          />
          <KpiCard
            label="Properties affected"
            value={String(grouped.length)}
            tone="muted"
            hint={`${windowDef.label.toLowerCase()}`}
            loading={isLoading}
            icon={CalendarClock}
          />
          <KpiCard
            label="Next expiry"
            value={
              nextExpiry
                ? `${nextExpiry.days_remaining}d`
                : '—'
            }
            tone="muted"
            hint={
              nextExpiry
                ? `${DOC_TYPE_DISPLAY_NAMES[nextExpiry.document_type] || nextExpiry.document_type} · ${nextExpiry.property_address}`
                : 'Nothing scheduled'
            }
            loading={isLoading}
            icon={Clock}
          />
        </div>

        {/* Hub tabs */}
        <ComplianceHubTabs />

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search property or certificate type…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {WINDOW_OPTIONS.map((w) => (
                <Button
                  key={w.id}
                  variant={windowId === w.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setWindowId(w.id)}
                >
                  {w.label}
                </Button>
              ))}
            </div>
            {snoozedCount > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setShowSnoozed((v) => !v)}>
                <BellOff className="h-4 w-4 mr-1" />
                {showSnoozed ? 'Hide' : 'Show'} snoozed ({snoozedCount})
              </Button>
            )}
          </CardContent>
        </Card>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="All clear"
            description={
              search || windowId !== '30'
                ? 'No items match the current filters. Try widening the window.'
                : 'Nothing needs action in the next 30 days. Great work.'
            }
          />
        ) : (
          <div className="space-y-3">
            {grouped.map((g) => (
              <Card key={g.propertyId || g.address}>
                <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2 min-w-0">
                    <span className="truncate">{g.address}</span>
                    <Badge variant="outline" className="shrink-0">
                      {g.rows.length} item{g.rows.length === 1 ? '' : 's'}
                    </Badge>
                  </CardTitle>
                  {g.propertyId && (
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/properties-v2/${g.propertyId}?tab=compliance`}>
                        Open property <ArrowRight className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="divide-y divide-border p-0">
                  {g.rows.map((r) => {
                    const meta = STATUS_META[r.calculated_status as Status];
                    const snoozeKey = `compliance:${r.requirement_id}`;
                    return (
                      <div key={r.requirement_id} className="flex items-center gap-3 p-3 hover:bg-muted/40">
                        <AlertTriangle
                          className={cn(
                            'h-4 w-4 shrink-0',
                            meta.tone === 'destructive' ? 'text-destructive' : 'text-amber-500',
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">
                            {DOC_TYPE_DISPLAY_NAMES[r.document_type] || r.document_type}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {r.calculated_status === 'missing'
                              ? 'No certificate on file'
                              : `${meta.label} · ${relativeDays(r.days_remaining)}`}
                            {r.expiry_date && r.calculated_status !== 'missing' && (
                              <> · expires {new Date(r.expiry_date).toLocaleDateString('en-GB')}</>
                            )}
                          </div>
                        </div>
                        {meta.tone === 'destructive' ? (
                          <Badge variant="destructive">{meta.label}</Badge>
                        ) : (
                          <Badge className="bg-amber-500 hover:bg-amber-500/90 text-white">{meta.label}</Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => snooze(snoozeKey, 7)}
                          title="Snooze 7 days"
                        >
                          <BellOff className="h-4 w-4" />
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link
                            to={
                              r.property_id
                                ? `/compliance-v2?status=needs_attention&q=${encodeURIComponent(r.property_address || '')}`
                                : '/compliance-v2'
                            }
                          >
                            Fix <ArrowRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone,
  loading,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: 'success' | 'warning' | 'destructive' | 'muted';
  loading?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  if (loading) return <Skeleton className="h-24" />;
  const toneClass =
    tone === 'success'
      ? 'text-success'
      : tone === 'warning'
        ? 'text-amber-500'
        : tone === 'destructive'
          ? 'text-destructive'
          : 'text-foreground';
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3">
        <div className={cn('text-2xl font-bold leading-none', toneClass)}>{value}</div>
        {hint && <p className="text-[11px] text-muted-foreground mt-1 leading-tight truncate">{hint}</p>}
      </CardContent>
    </Card>
  );
}
