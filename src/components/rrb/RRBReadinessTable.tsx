import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ListState } from '@/components/ListState';
import { ExternalLink, AlertTriangle, Gauge } from 'lucide-react';
import { useRRBReadinessPortfolio, useRRBReadinessProperty, type RRBReadinessRow } from '@/hooks/useRRBReadiness';
import { usePropertiesV2 } from '@/hooks/usePropertiesV2';

function totalBadge(score: number) {
  if (score >= 80) {
    return <Badge className="bg-success/15 text-success hover:bg-success/20">{score}/100</Badge>;
  }
  if (score >= 60) {
    return <Badge className="bg-warning/15 text-warning hover:bg-warning/20">{score}/100</Badge>;
  }
  return <Badge variant="destructive">{score}/100</Badge>;
}

function SubChip({ label, value }: { label: string; value: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
      title={label}
    >
      <span className="uppercase tracking-wide">{label}</span>
      <span className="text-foreground">{value}</span>
    </span>
  );
}

function MissingChip({ propertyId }: { propertyId: string }) {
  const { data } = useRRBReadinessProperty(propertyId);
  const items = data?.missingData ?? [];
  if (items.length === 0) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[11px] font-medium hover:bg-destructive/20"
          aria-label={`${items.length} missing items`}
        >
          <AlertTriangle className="h-3 w-3" /> {items.length} missing
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-xs">
        <p className="font-medium mb-2">Missing data</p>
        <ul className="space-y-1 list-disc pl-4">
          {items.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export function RRBReadinessTable() {
  const { data, isLoading, error, refetch } = useRRBReadinessPortfolio();
  const { data: properties } = usePropertiesV2();

  const addressFor = (id: string) => {
    const p = properties?.find((x) => x.id === id);
    if (!p) return id.slice(0, 8);
    return [p.address_line_1, p.city, p.postcode].filter(Boolean).join(', ');
  };

  const rows: RRBReadinessRow[] = (data?.rows ?? []).slice().sort((a, b) => a.total_score - b.total_score);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Gauge className="h-4 w-4" /> Per-property RRB readiness
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ListState
          isLoading={isLoading}
          error={error as Error | null}
          isEmpty={rows.length === 0}
          emptyTitle="No properties scored yet"
          emptyDescription="Add a property to see Renters' Rights Bill readiness scores."
          onRetry={() => refetch()}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2 pr-3">Address</th>
                  <th className="text-left py-2 pr-3">Total</th>
                  <th className="text-left py-2 pr-3">Sub-scores</th>
                  <th className="text-left py-2 pr-3">Missing</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.property_id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 pr-3">
                      <Link
                        to={`/properties-v2/${r.property_id}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        {addressFor(r.property_id)}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{totalBadge(r.total_score)}</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-1">
                        <SubChip label="Ten" value={r.tenancy_score} />
                        <SubChip label="Dep" value={r.deposit_score} />
                        <SubChip label="Rent" value={r.rent_score} />
                        <SubChip label="Cmp" value={r.compliance_score} />
                        <SubChip label="HMO" value={r.hmo_score} />
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      <MissingChip propertyId={r.property_id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ListState>
      </CardContent>
    </Card>
  );
}

export default RRBReadinessTable;
