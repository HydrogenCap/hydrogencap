import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { PageSkeleton, EmptyState } from '@/components/common';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useMissingInfo } from '@/hooks/useMissingInfo';
import { usePortfolioRisks } from '@/hooks/usePortfolioRisks';
import { useSnoozedItems } from '@/hooks/useSnoozedItems';
import {
  Wrench, AlertTriangle, ArrowRight, BellOff, Search, CheckCircle2,
} from 'lucide-react';

type Impact = 'high' | 'medium' | 'low';

type FixCategory =
  | 'property' | 'finance' | 'income' | 'insurance' | 'passport'
  | 'compliance' | 'tenancy' | 'valuation' | 'other';

interface FixItem {
  key: string;
  category: FixCategory;
  impact: Impact;
  what: string;
  where: string;        // property/entity label
  url: string;
  count?: number;
}

const CATEGORY_LABELS: Record<FixCategory, string> = {
  property: 'Property details',
  finance: 'Finance & mortgage',
  income: 'Income',
  insurance: 'Insurance',
  passport: 'Passport',
  compliance: 'Compliance',
  tenancy: 'Tenancy',
  valuation: 'Valuation',
  other: 'Other',
};

const CATEGORY_ORDER: FixCategory[] = [
  'compliance', 'tenancy', 'finance', 'property', 'income', 'insurance', 'valuation', 'passport', 'other',
];

const IMPACT_RANK: Record<Impact, number> = { high: 3, medium: 2, low: 1 };

function ImpactBadge({ impact }: { impact: Impact }) {
  if (impact === 'high') return <Badge variant="destructive">High</Badge>;
  if (impact === 'medium') return <Badge className="bg-amber-500 hover:bg-amber-500/90 text-white">Medium</Badge>;
  return <Badge variant="secondary">Low</Badge>;
}

export default function FixIt() {
  usePageTitle('Fix-it queue');
  const { isSnoozed, snooze, snoozedCount } = useSnoozedItems();

  const { data: missingInfo, isLoading: missingLoading } = useMissingInfo();
  const { risks, isLoading: risksLoading } = usePortfolioRisks();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | FixCategory>('all');
  const [impactFilter, setImpactFilter] = useState<'all' | Impact>('all');
  const [showSnoozed, setShowSnoozed] = useState(false);

  const items: FixItem[] = useMemo(() => {
    const out: FixItem[] = [];

    // ---- Missing-info derived items (one row per category per property) ----
    if (missingInfo) {
      for (const m of missingInfo) {
        const address = m.property.address_line_1 || 'Unnamed property';
        const url = `/properties-v2/${m.property.id}`;

        if (m.missingPropertyCoreFields.length > 0) {
          out.push({
            key: `mi:property:${m.property.id}`,
            category: 'property', impact: 'medium',
            what: `${m.missingPropertyCoreFields.length} property field${m.missingPropertyCoreFields.length === 1 ? '' : 's'} missing`,
            where: address, url, count: m.missingPropertyCoreFields.length,
          });
        }
        if (m.missingFinanceFields.length > 0) {
          out.push({
            key: `mi:finance:${m.property.id}`,
            category: 'finance', impact: 'high',
            what: `${m.missingFinanceFields.length} finance field${m.missingFinanceFields.length === 1 ? '' : 's'} missing`,
            where: address, url, count: m.missingFinanceFields.length,
          });
        }
        if (m.missingIncomeFields.length > 0) {
          out.push({
            key: `mi:income:${m.property.id}`,
            category: 'income', impact: 'medium',
            what: `${m.missingIncomeFields.length} income field${m.missingIncomeFields.length === 1 ? '' : 's'} missing`,
            where: address, url, count: m.missingIncomeFields.length,
          });
        }
        if (m.missingInsuranceFields.length > 0) {
          out.push({
            key: `mi:insurance:${m.property.id}`,
            category: 'insurance', impact: 'medium',
            what: `${m.missingInsuranceFields.length} insurance field${m.missingInsuranceFields.length === 1 ? '' : 's'} missing`,
            where: address, url, count: m.missingInsuranceFields.length,
          });
        }
        if (m.missingCriticalPassportFields.length > 0) {
          out.push({
            key: `mi:passport-critical:${m.property.id}`,
            category: 'passport', impact: 'high',
            what: `${m.missingCriticalPassportFields.length} critical passport field${m.missingCriticalPassportFields.length === 1 ? '' : 's'} missing`,
            where: address, url, count: m.missingCriticalPassportFields.length,
          });
        } else if (m.missingPassportFields.length > 0) {
          out.push({
            key: `mi:passport:${m.property.id}`,
            category: 'passport', impact: 'low',
            what: `${m.missingPassportFields.length} passport field${m.missingPassportFields.length === 1 ? '' : 's'} missing`,
            where: address, url, count: m.missingPassportFields.length,
          });
        }
      }
    }

    // ---- Risk-derived items ----
    if (risks) {
      for (const r of risks) {
        let cat: FixCategory = 'other';
        if (r.type === 'tenancy_compliance' || r.type === 'lease_expiry') cat = 'tenancy';
        else if (r.type === 'insurance') cat = 'insurance';
        else if (r.type === 'ltv' || r.type === 'rate_expiry' || r.type === 'negative_cashflow') cat = 'finance';
        else if (r.type === 'epc' || r.type === 'hmo_licence') cat = 'compliance';
        else if (r.type === 'operational_data') cat = 'property';

        out.push({
          key: `risk:${r.id}`,
          category: cat,
          impact: r.severity === 'critical' ? 'high' : 'medium',
          what: r.message,
          where: r.address,
          url: r.targetUrl,
        });
      }
    }

    return out;
  }, [missingInfo, risks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((i) => showSnoozed ? isSnoozed(i.key) : !isSnoozed(i.key))
      .filter((i) => categoryFilter === 'all' || i.category === categoryFilter)
      .filter((i) => impactFilter === 'all' || i.impact === impactFilter)
      .filter((i) =>
        !q ||
        i.what.toLowerCase().includes(q) ||
        i.where.toLowerCase().includes(q))
      .sort((a, b) => {
        const ra = IMPACT_RANK[b.impact] - IMPACT_RANK[a.impact];
        if (ra !== 0) return ra;
        const ca = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
        if (ca !== 0) return ca;
        return a.where.localeCompare(b.where);
      });
  }, [items, search, categoryFilter, impactFilter, showSnoozed, isSnoozed]);

  const groups = useMemo(() => {
    const m = new Map<FixCategory, FixItem[]>();
    for (const i of filtered) {
      if (!m.has(i.category)) m.set(i.category, []);
      m.get(i.category)!.push(i);
    }
    return Array.from(m.entries()).sort(
      (a, b) => CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0]),
    );
  }, [filtered]);

  if (missingLoading || risksLoading) {
    return <AppLayout><PageSkeleton tabs={0} /></AppLayout>;
  }

  const totalActive = items.filter((i) => !isSnoozed(i.key)).length;
  const highImpactCount = items.filter((i) => !isSnoozed(i.key) && i.impact === 'high').length;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl">
        <header className="space-y-2">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl tracking-tight flex items-center gap-3"
                  style={{ fontFamily: 'DM Serif Display, serif' }}>
                <Wrench className="h-7 w-7 text-muted-foreground" />
                Fix-it queue
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Every gap and risk across your portfolio, prioritised. Click a row to jump straight to the fix.
              </p>
            </div>
            <div className="flex gap-2">
              <Badge variant={highImpactCount > 0 ? 'destructive' : 'secondary'} className="text-sm px-3 py-1">
                {highImpactCount} high impact
              </Badge>
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {totalActive} total
              </Badge>
            </div>
          </div>
        </header>

        <Card>
          <CardContent className="p-4 flex flex-col md:flex-row gap-3 md:items-center">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by property or what's missing…"
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as 'all' | FixCategory)}>
              <SelectTrigger className="w-full md:w-48"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORY_ORDER.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={impactFilter} onValueChange={(v) => setImpactFilter(v as 'all' | Impact)}>
              <SelectTrigger className="w-full md:w-36"><SelectValue placeholder="Impact" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All impact</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={showSnoozed ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowSnoozed((s) => !s)}
            >
              <BellOff className="h-4 w-4 mr-2" />
              {showSnoozed ? 'Showing snoozed' : `Snoozed (${snoozedCount})`}
            </Button>
          </CardContent>
        </Card>

        {filtered.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title={showSnoozed ? 'No snoozed items' : 'Nothing to fix'}
            description={
              showSnoozed
                ? 'You have no snoozed items matching the current filters.'
                : 'Your portfolio is in great shape. Check back later or browse Today.'
            }
          />
        ) : (
          <div className="space-y-4">
            {groups.map(([cat, list]) => (
              <Card key={cat}>
                <div className="flex items-center justify-between px-6 py-3 border-b border-border">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    {CATEGORY_LABELS[cat]}
                  </h2>
                  <Badge variant="secondary">{list.length}</Badge>
                </div>
                <ul className="divide-y divide-border">
                  {list.map((item) => (
                    <li key={item.key} className="flex items-start gap-3 px-6 py-3 group hover:bg-muted/40 transition-colors">
                      <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${
                        item.impact === 'high' ? 'text-destructive' :
                        item.impact === 'medium' ? 'text-amber-500' : 'text-muted-foreground'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.what}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.where}</p>
                      </div>
                      <ImpactBadge impact={item.impact} />
                      <Button asChild variant="ghost" size="sm" className="h-8">
                        <Link to={item.url}>Fix <ArrowRight className="ml-1 h-3 w-3" /></Link>
                      </Button>
                      {!showSnoozed ? (
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => snooze(item.key, 7)}
                          aria-label="Snooze 7 days" title="Snooze 7 days"
                        >
                          <BellOff className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost" size="sm" className="h-8"
                          onClick={() => snooze(item.key, 0)}
                        >
                          Unsnooze
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
