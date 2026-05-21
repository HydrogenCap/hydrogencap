import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { PageSkeleton, EmptyState } from '@/components/common';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePropertiesV2 } from '@/hooks/usePropertiesV2';
import { usePropertyComplianceStatus } from '@/hooks/usePropertyComplianceStatus';
import { useMissingInfo } from '@/hooks/useMissingInfo';
import {
  BarChart3, Banknote, TrendingUp, Leaf, ShieldCheck,
  ArrowRight, Search, CheckCircle2,
} from 'lucide-react';
import { differenceInMonths, parseISO } from 'date-fns';

type Category = 'mortgage' | 'valuation' | 'epc' | 'compliance';

interface PropertyRow {
  id: string;
  address: string;
  missing: Set<Category>;
  details: Record<Category, string>;
  completeness: number;
}

const CATEGORY_META: Record<Category, { label: string; icon: any; tone: string }> = {
  mortgage:   { label: 'Mortgage',   icon: Banknote,    tone: 'text-blue-600' },
  valuation:  { label: 'Valuation',  icon: TrendingUp,  tone: 'text-purple-600' },
  epc:        { label: 'EPC',        icon: Leaf,        tone: 'text-green-600' },
  compliance: { label: 'Compliance', icon: ShieldCheck, tone: 'text-amber-600' },
};

export default function DataQuality() {
  usePageTitle('Data Quality');
  const { data: properties, isLoading: pLoading } = usePropertiesV2();
  const { byProperty: complianceMap, isLoading: cLoading } = usePropertyComplianceStatus();
  const missingInfo = useMissingInfo();
  const { data: missingData, isLoading: mLoading } = missingInfo as any;

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | Category>('all');

  const rows = useMemo<PropertyRow[]>(() => {
    if (!properties) return [];
    const missingByProperty = new Map<string, any>();
    (missingData || []).forEach((m: any) => missingByProperty.set(m.property.id, m));

    return properties.map((p) => {
      const missing = new Set<Category>();
      const details: Record<Category, string> = {
        mortgage: 'Complete', valuation: 'Complete', epc: 'Complete', compliance: 'Complete',
      };

      const mi = missingByProperty.get(p.id);
      const missingFinance = (mi?.missingFinanceFields || []) as string[];
      if (missingFinance.length > 0) {
        missing.add('mortgage');
        details.mortgage = `${missingFinance.length} field${missingFinance.length === 1 ? '' : 's'} missing`;
      }

      // Valuation
      const noValue = !p.current_valuation || Number(p.current_valuation) <= 0;
      const noDate = !p.valuation_date;
      const stale =
        p.valuation_date &&
        differenceInMonths(new Date(), parseISO(p.valuation_date)) > 24;
      if (noValue && noDate) {
        missing.add('valuation');
        details.valuation = 'No valuation on file';
      } else if (noValue) {
        missing.add('valuation');
        details.valuation = 'Value not set';
      } else if (noDate) {
        missing.add('valuation');
        details.valuation = 'Valuation date missing';
      } else if (stale) {
        missing.add('valuation');
        details.valuation = 'Valuation >24 months old';
      }

      // EPC
      const noRating = !p.epc_rating;
      const noExpiry = !p.epc_expiry_date;
      const expired =
        p.epc_expiry_date && new Date(p.epc_expiry_date).getTime() < Date.now();
      if (noRating && noExpiry) {
        missing.add('epc');
        details.epc = 'No EPC on file';
      } else if (expired) {
        missing.add('epc');
        details.epc = 'EPC expired';
      } else if (noRating) {
        missing.add('epc');
        details.epc = 'Rating missing';
      } else if (noExpiry) {
        missing.add('epc');
        details.epc = 'Expiry date missing';
      }

      // Compliance
      const comp = complianceMap.get(p.id);
      if (!comp || comp.total === 0) {
        missing.add('compliance');
        details.compliance = 'No requirements mapped';
      } else if (comp.level === 'expired') {
        missing.add('compliance');
        details.compliance = comp.label;
      } else if (comp.level === 'expiring') {
        missing.add('compliance');
        details.compliance = comp.label;
      }

      const total = 4;
      const ok = total - missing.size;
      const completeness = Math.round((ok / total) * 100);

      const address = [p.address_line_1, p.city].filter(Boolean).join(', ') || 'Unnamed property';

      return { id: p.id, address, missing, details, completeness };
    });
  }, [properties, complianceMap, missingData]);

  const filtered = useMemo(() => {
    let out = rows;
    if (filter !== 'all') out = out.filter((r) => r.missing.has(filter));
    if (search) {
      const q = search.toLowerCase();
      out = out.filter((r) => r.address.toLowerCase().includes(q));
    }
    return out.sort((a, b) => b.missing.size - a.missing.size || a.address.localeCompare(b.address));
  }, [rows, filter, search]);

  const categoryStats = useMemo(() => {
    const totals: Record<Category, number> = { mortgage: 0, valuation: 0, epc: 0, compliance: 0 };
    rows.forEach((r) => r.missing.forEach((c) => totals[c]++));
    return totals;
  }, [rows]);

  const overall = useMemo(() => {
    if (rows.length === 0) return 100;
    const sum = rows.reduce((acc, r) => acc + r.completeness, 0);
    return Math.round(sum / rows.length);
  }, [rows]);

  if (pLoading || cLoading || mLoading) {
    return <AppLayout><PageSkeleton /></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6">
        <header>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Data Quality
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Mortgage, valuation, EPC and compliance coverage across {rows.length} propert{rows.length === 1 ? 'y' : 'ies'}.
          </p>
        </header>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Overall portfolio completeness</span>
              <span className="text-2xl font-bold">{overall}%</span>
            </div>
            <Progress value={overall} />
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(CATEGORY_META) as Category[]).map((cat) => {
            const meta = CATEGORY_META[cat];
            const Icon = meta.icon;
            const count = categoryStats[cat];
            const active = filter === cat;
            return (
              <Card
                key={cat}
                className={`cursor-pointer transition-colors ${active ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/40'}`}
                onClick={() => setFilter(active ? 'all' : cat)}
              >
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                      <Icon className={`h-4 w-4 ${meta.tone}`} />
                      {meta.label}
                    </div>
                    {count === 0 && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                  </div>
                  <div className="text-2xl font-bold mt-1">{count}</div>
                  <div className="text-xs text-muted-foreground">
                    {count === 0 ? 'all properties complete' : `propert${count === 1 ? 'y' : 'ies'} need attention`}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardContent className="pt-4 flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search properties..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            {filter !== 'all' && (
              <Button variant="outline" size="sm" onClick={() => setFilter('all')}>
                Clear filter: {CATEGORY_META[filter].label}
              </Button>
            )}
          </CardContent>
        </Card>

        {filtered.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Nothing to flag"
            description="All properties match the current filters."
          />
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {filtered.length} propert{filtered.length === 1 ? 'y' : 'ies'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border">
              {filtered.map((r) => (
                <div key={r.id} className="p-3 hover:bg-muted/40">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{r.address}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress value={r.completeness} className="h-1.5 flex-1 max-w-[120px]" />
                        <span className="text-xs text-muted-foreground">{r.completeness}%</span>
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/properties-v2/${r.id}`}>
                        Open <ArrowRight className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                    {(Object.keys(CATEGORY_META) as Category[]).map((cat) => {
                      const meta = CATEGORY_META[cat];
                      const Icon = meta.icon;
                      const isMissing = r.missing.has(cat);
                      return (
                        <div
                          key={cat}
                          className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border ${
                            isMissing
                              ? 'border-amber-500/40 bg-amber-500/5 text-foreground'
                              : 'border-border text-muted-foreground'
                          }`}
                        >
                          <Icon className={`h-3 w-3 ${isMissing ? meta.tone : ''}`} />
                          <span className="truncate">{r.details[cat]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
