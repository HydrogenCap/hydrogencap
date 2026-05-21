import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageSkeleton, EmptyState } from '@/components/common';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSnoozedItems } from '@/hooks/useSnoozedItems';
import { AlertTriangle, Shield, BellOff, Search, ArrowRight, CheckCircle2 } from 'lucide-react';

type Status = 'critical' | 'expired' | 'missing' | 'expiring_soon';

interface Row {
  requirement_id: string;
  property_id: string | null;
  property_address: string | null;
  document_type: string | null;
  calculated_status: Status;
  days_remaining: number | null;
  expiry_date: string | null;
  urgency_score: number | null;
}

const STATUS_META: Record<Status, { label: string; rank: number; tone: 'destructive' | 'warning' | 'muted' }> = {
  critical: { label: 'Critical', rank: 4, tone: 'destructive' },
  expired: { label: 'Expired', rank: 3, tone: 'destructive' },
  missing: { label: 'Missing', rank: 2, tone: 'warning' },
  expiring_soon: { label: 'Expiring', rank: 1, tone: 'warning' },
};

export default function ComplianceActions() {
  usePageTitle('Compliance Actions');
  const { isSnoozed, snooze, snoozedCount } = useSnoozedItems();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all');
  const [showSnoozed, setShowSnoozed] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['compliance_action_centre'],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('compliance_matrix_v2')
        .select('requirement_id, property_id, property_address, document_type, calculated_status, days_remaining, expiry_date, urgency_score')
        .in('calculated_status', ['critical', 'expired', 'missing', 'expiring_soon']);
      if (error) throw error;
      return (data || []) as Row[];
    },
    staleTime: 30_000,
  });

  const rows = useMemo(() => {
    if (!data) return [];
    const filtered = data.filter((r) => {
      if (statusFilter !== 'all' && r.calculated_status !== statusFilter) return false;
      const snoozeKey = `compliance:${r.requirement_id}`;
      if (!showSnoozed && isSnoozed(snoozeKey)) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${r.property_address || ''} ${r.document_type || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return filtered.sort((a, b) => {
      const ra = STATUS_META[a.calculated_status].rank;
      const rb = STATUS_META[b.calculated_status].rank;
      if (ra !== rb) return rb - ra;
      return (b.urgency_score || 0) - (a.urgency_score || 0);
    });
  }, [data, statusFilter, search, isSnoozed, showSnoozed]);

  const counts = useMemo(() => {
    const c = { critical: 0, expired: 0, missing: 0, expiring_soon: 0 };
    for (const r of data || []) c[r.calculated_status]++;
    return c;
  }, [data]);

  if (isLoading) return <AppLayout><PageSkeleton /></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Compliance Action Centre
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Every certificate that needs attention, sorted by urgency.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <StatChip label="Critical" value={counts.critical} tone="destructive" />
            <StatChip label="Expired" value={counts.expired} tone="destructive" />
            <StatChip label="Missing" value={counts.missing} tone="warning" />
            <StatChip label="Expiring" value={counts.expiring_soon} tone="warning" />
          </div>
        </header>

        <Card>
          <CardContent className="pt-4 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by property or document type..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex gap-1">
              {(['all', 'critical', 'expired', 'missing', 'expiring_soon'] as const).map((s) => (
                <Button
                  key={s}
                  variant={statusFilter === s ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(s)}
                >
                  {s === 'all' ? 'All' : STATUS_META[s].label}
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

        {rows.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="All clear"
            description="No compliance issues match your filters. Nice work."
          />
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{rows.length} item{rows.length === 1 ? '' : 's'}</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border p-0">
              {rows.map((r) => {
                const meta = STATUS_META[r.calculated_status];
                const snoozeKey = `compliance:${r.requirement_id}`;
                const url = r.property_id ? `/properties-v2/${r.property_id}?tab=compliance` : '/compliance-v2';
                return (
                  <div key={r.requirement_id} className="flex items-center gap-3 p-3 hover:bg-muted/40">
                    <AlertTriangle
                      className={`h-4 w-4 shrink-0 ${
                        meta.tone === 'destructive' ? 'text-destructive' : 'text-amber-500'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {r.document_type || 'Unknown'} ·{' '}
                        <span className="text-muted-foreground font-normal">
                          {r.property_address || 'Unknown property'}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.calculated_status === 'missing'
                          ? 'No certificate on file'
                          : r.expiry_date
                          ? `${meta.label} · ${r.days_remaining !== null ? `${Math.abs(r.days_remaining)}d ${r.days_remaining < 0 ? 'overdue' : 'remaining'}` : ''}`
                          : meta.label}
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
                      <Link to={url}>
                        Fix <ArrowRight className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

function StatChip({ label, value, tone }: { label: string; value: number; tone: 'destructive' | 'warning' }) {
  if (value === 0) return null;
  return (
    <div className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm">
      <span
        className={`h-2 w-2 rounded-full ${
          tone === 'destructive' ? 'bg-destructive' : 'bg-amber-500'
        }`}
      />
      <span className="font-semibold">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
