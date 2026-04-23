import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, XCircle, ShieldCheck, Filter, Download, Building2, Users,
  AlertTriangle, ChevronRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SEVERITY } from '@/lib/design-tokens';
import { useHMOPortfolioCompliance, type PortfolioHMOItem } from '@/hooks/useHMOCompliance';

export function HMOComplianceOverview() {
  const { data: items, isLoading } = useHMOPortfolioCompliance();
  const [showNonCompliantOnly, setShowNonCompliantOnly] = useState(false);
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    if (!items) return [];
    if (showNonCompliantOnly) return items.filter(i => !i.compliance.overallCompliant);
    return items;
  }, [items, showNonCompliantOnly]);

  const summary = useMemo(() => {
    if (!items) return { total: 0, compliant: 0, nonCompliant: 0 };
    const compliant = items.filter(i => i.compliance.overallCompliant).length;
    return { total: items.length, compliant, nonCompliant: items.length - compliant };
  }, [items]);

  const handleExport = () => {
    if (!filtered || filtered.length === 0) return;

    const csvRows = [
      ['Property Address', 'Compliant', 'Occupants', 'Bedrooms', 'Bathrooms', 'Kitchens', 'Toilets', 'Issues'].join(','),
      ...filtered.map(item => {
        const c = item.compliance;
        return [
          `"${item.address}"`,
          c.overallCompliant ? 'Yes' : 'No',
          c.totalOccupants,
          c.roomResults.length,
          c.totalBathrooms,
          c.totalKitchens,
          c.totalToilets,
          `"${c.issues.join('; ')}"`,
        ].join(',');
      }),
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hmo-compliance-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          label="Total HMO Properties"
          value={summary.total}
          icon={<Building2 className="h-5 w-5 text-muted-foreground" />}
          severity="neutral"
        />
        <SummaryCard
          label="Compliant"
          value={summary.compliant}
          icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
          severity="success"
        />
        <SummaryCard
          label="Non-Compliant"
          value={summary.nonCompliant}
          icon={<XCircle className="h-5 w-5 text-red-600" />}
          severity={summary.nonCompliant > 0 ? 'critical' : 'success'}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          <h3 className="text-lg font-semibold">HMO Properties</h3>
          <Badge variant="secondary">{filtered.length}</Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant={showNonCompliantOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowNonCompliantOnly(!showNonCompliantOnly)}
          >
            <Filter className="h-4 w-4 mr-1" />
            {showNonCompliantOnly ? 'Showing Non-Compliant' : 'Filter Non-Compliant'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Property List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            {showNonCompliantOnly
              ? 'All HMO properties are compliant.'
              : 'No HMO properties found. Properties typed as HMO (Licensed) or HMO (Mandatory) will appear here.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <PropertyComplianceCard
              key={item.propertyId}
              item={item}
              onClick={() => navigate(`/properties/${item.propertyId}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  severity,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  severity: keyof typeof SEVERITY;
}) {
  return (
    <Card className={`${SEVERITY[severity].border}`}>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
        </div>
        {icon}
      </CardContent>
    </Card>
  );
}

function PropertyComplianceCard({ item, onClick }: { item: PortfolioHMOItem; onClick: () => void }) {
  const { compliance } = item;
  const roomIssues = compliance.roomResults.filter(r => !r.isCompliant).length;
  const amenityIssues = [
    !compliance.amenityResults.bathroomCompliant,
    !compliance.amenityResults.kitchenCompliant,
    !compliance.amenityResults.toiletCompliant,
  ].filter(Boolean).length;

  return (
    <Card
      className="cursor-pointer hover:border-primary/50 transition-colors"
      onClick={onClick}
    >
      <CardContent className="flex items-center justify-between p-4 gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium truncate">{item.address}</span>
            {compliance.overallCompliant ? (
              <Badge className={SEVERITY.success.badge}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> Compliant
              </Badge>
            ) : (
              <Badge className={SEVERITY.critical.badge}>
                <XCircle className="h-3 w-3 mr-1" /> Non-Compliant
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {compliance.totalOccupants} occupants
            </span>
            <span>{compliance.roomResults.length} bedrooms</span>
            {!compliance.overallCompliant && (
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                {roomIssues > 0 && `${roomIssues} room${roomIssues !== 1 ? 's' : ''} undersized`}
                {roomIssues > 0 && amenityIssues > 0 && ' · '}
                {amenityIssues > 0 && `${amenityIssues} amenity gap${amenityIssues !== 1 ? 's' : ''}`}
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
      </CardContent>
    </Card>
  );
}
