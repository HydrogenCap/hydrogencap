import { Link } from 'react-router-dom';
import { Check, X, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCoverageGaps, TRACKER_POLICY_TYPES } from '@/hooks/useInsuranceTracker';
import { SEVERITY } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';

const REQUIRED_TYPES = ['buildings', 'landlord_liability'];

function CoverageIcon({ covered, required }: { covered: boolean; required: boolean }) {
  if (covered) {
    return <Check className="h-4 w-4 text-green-600 dark:text-green-400" />;
  }
  if (required) {
    return <X className="h-4 w-4 text-red-500" />;
  }
  return <X className="h-4 w-4 text-muted-foreground/30" />;
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
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 bg-muted animate-pulse rounded" />
            ))}
          </div>
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
          <p className="text-muted-foreground text-sm">No properties found. Add properties to see coverage matrix.</p>
        </CardContent>
      </Card>
    );
  }

  const propertiesWithGaps = gaps.filter(g => g.hasGaps);

  return (
    <div className="space-y-4">
      {propertiesWithGaps.length > 0 && (
        <Card className={cn('border', SEVERITY.critical.border)}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className={cn('h-4 w-4', SEVERITY.critical.text)} />
              <span className={cn('text-sm font-medium', SEVERITY.critical.text)}>
                {propertiesWithGaps.length} {propertiesWithGaps.length === 1 ? 'property' : 'properties'} missing required coverage
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Coverage Matrix</CardTitle>
            {propertiesWithGaps.length > 0 && (
              <Badge className={cn('gap-1', SEVERITY.critical.badge)}>
                <AlertTriangle className="h-3 w-3" />
                {propertiesWithGaps.length} with gaps
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Property</TableHead>
                  {TRACKER_POLICY_TYPES.map(type => (
                    <TableHead key={type.value} className="text-center w-20 whitespace-nowrap">
                      {type.label}
                      {REQUIRED_TYPES.includes(type.value) && (
                        <span className="text-destructive ml-0.5">*</span>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {gaps.map(property => (
                  <TableRow
                    key={property.id}
                    className={cn(property.hasGaps && 'bg-red-50/50 dark:bg-red-950/10')}
                  >
                    <TableCell>
                      <Link
                        to={`/properties-v2/${property.id}`}
                        className="hover:underline"
                      >
                        <div className="font-medium text-sm">{property.address_line}</div>
                        <div className="text-xs text-muted-foreground">{property.postcode}</div>
                      </Link>
                      {property.hasGaps && (
                        <Badge className={cn('ml-1 mt-1 text-xs', SEVERITY.critical.badge)}>
                          Missing: {property.missingRequired.join(', ')}
                        </Badge>
                      )}
                    </TableCell>
                    {TRACKER_POLICY_TYPES.map(type => (
                      <TableCell key={type.value} className="text-center">
                        <div className="flex justify-center">
                          <CoverageIcon
                            covered={property.coverage[type.value]}
                            required={REQUIRED_TYPES.includes(type.value)}
                          />
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground px-4 py-3 border-t">
            <span className="text-destructive">*</span> Required coverage types. Red indicates missing required coverage.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
