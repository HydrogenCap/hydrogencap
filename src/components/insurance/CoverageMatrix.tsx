import { Check, X, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCoverageGaps, TRACKER_POLICY_TYPES } from '@/hooks/useInsuranceTracker';

function CoverageIcon({ covered, required }: { covered: boolean; required: boolean }) {
  if (covered) {
    return <Check className="h-4 w-4 text-emerald-600" />;
  }
  if (required) {
    return <X className="h-4 w-4 text-destructive" />;
  }
  return <span className="h-4 w-4 text-muted-foreground">—</span>;
}

export function CoverageMatrix() {
  const { data: gaps, isLoading } = useCoverageGaps();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Coverage Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!gaps || gaps.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Coverage Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No properties found.</p>
        </CardContent>
      </Card>
    );
  }

  const requiredTypes = ['buildings', 'landlord_liability'];
  const propertiesWithGaps = gaps.filter(g => g.hasGaps);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Coverage Matrix</CardTitle>
          {propertiesWithGaps.length > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {propertiesWithGaps.length} with gaps
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-medium">Property</th>
                {TRACKER_POLICY_TYPES.map(type => (
                  <th key={type.value} className="text-center px-2 py-2 font-medium whitespace-nowrap">
                    {type.label}
                    {requiredTypes.includes(type.value) && (
                      <span className="text-destructive ml-0.5">*</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gaps.map(property => (
                <tr
                  key={property.id}
                  className={`border-b last:border-0 ${property.hasGaps ? 'bg-destructive/5' : ''}`}
                >
                  <td className="py-2 pr-4">
                    <div className="font-medium">{property.address_line}</div>
                    <div className="text-xs text-muted-foreground">{property.postcode}</div>
                  </td>
                  {TRACKER_POLICY_TYPES.map(type => (
                    <td key={type.value} className="text-center px-2 py-2">
                      <div className="flex justify-center">
                        <CoverageIcon
                          covered={property.coverage[type.value]}
                          required={requiredTypes.includes(type.value)}
                        />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          <span className="text-destructive">*</span> Required coverage types. Red indicates missing required coverage.
        </p>
      </CardContent>
    </Card>
  );
}
