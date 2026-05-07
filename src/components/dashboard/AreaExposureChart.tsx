import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { Payload as TooltipPayload } from 'recharts/types/component/DefaultTooltipContent';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertTriangle, BarChart3, Bug, ChevronDown, ChevronUp } from 'lucide-react';
import { PropertyWithFinancials } from '@/hooks/usePropertiesCompat';
import { formatGBP } from '@/lib/calculations';
import { Link } from 'react-router-dom';
import { CHART_COLOURS, CHART_TOOLTIP_STYLE, CHART_AXIS_TICK } from '@/lib/chart-tokens';

interface AreaExposureChartProps {
  properties: PropertyWithFinancials[];
}

type GroupByField = 'area' | 'postcode_area' | 'local_authority';

interface AreaBucket {
  name: string;
  value: number;
  propertyCount: number;
  isOther?: boolean;
}

interface PropertyDebugInfo {
  id: string;
  address: string;
  rawValue: string | null;
  normalizedValue: string;
  bucket: string;
}

// Normalize text: trim, collapse whitespace, title case
function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  
  return text
    .trim()
    .replace(/\s+/g, ' ') // collapse multiple spaces
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

const DEFAULT_TOP_N = 6;

export function AreaExposureChart({ properties }: AreaExposureChartProps) {
  const [groupBy, setGroupBy] = useState<GroupByField>('area');
  const [showAll, setShowAll] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);

  // Process data with normalization
  const { areaData, missingCount, debugData } = useMemo(() => {
    if (!properties?.length) {
      return { areaData: [], missingCount: 0, debugData: [] };
    }

    const bucketMap: Record<string, { value: number; count: number }> = {};
    const debug: PropertyDebugInfo[] = [];
    let missing = 0;

    properties.forEach(property => {
      // Get raw field based on groupBy
      let rawValue: string | null = null;
      switch (groupBy) {
        case 'area':
          rawValue = property.area_name;
          break;
        case 'postcode_area':
          rawValue = property.postcode_area || (property.postcode ? property.postcode.split(' ')[0] : null);
          break;
        case 'local_authority':
          // Fall back to area_name if no separate local authority field
          rawValue = property.county || property.area_name;
          break;
      }

      // Normalize the value
      const normalizedValue = normalizeText(rawValue);
      const bucketName = normalizedValue || 'Unknown / Unassigned';

      // Track missing
      if (!rawValue || !rawValue.trim()) {
        missing++;
      }

      // Get property value
      const value = property.current_value_gbp ? Number(property.current_value_gbp) : 0;

      // Add to bucket
      if (!bucketMap[bucketName]) {
        bucketMap[bucketName] = { value: 0, count: 0 };
      }
      bucketMap[bucketName].value += value;
      bucketMap[bucketName].count += 1;

      // Debug info
      debug.push({
        id: property.id,
        address: property.address_line,
        rawValue: rawValue,
        normalizedValue: normalizedValue || '(empty)',
        bucket: bucketName,
      });
    });

    // Convert to sorted array
    const sorted = Object.entries(bucketMap)
      .map(([name, data]) => ({
        name,
        value: data.value,
        propertyCount: data.count,
      }))
      .sort((a, b) => b.value - a.value);

    return {
      areaData: sorted,
      missingCount: missing,
      debugData: debug.sort((a, b) => a.bucket.localeCompare(b.bucket)),
    };
  }, [properties, groupBy]);

  // Apply top-N limit with "Other" bucket if not showing all
  const displayData = useMemo((): AreaBucket[] => {
    if (showAll || areaData.length <= DEFAULT_TOP_N) {
      return areaData;
    }

    const topN = areaData.slice(0, DEFAULT_TOP_N);
    const rest = areaData.slice(DEFAULT_TOP_N);

    if (rest.length === 0) return topN;

    const otherValue = rest.reduce((sum, item) => sum + item.value, 0);
    const otherCount = rest.reduce((sum, item) => sum + item.propertyCount, 0);

    return [
      ...topN,
      {
        name: `Other (${rest.length} areas)`,
        value: otherValue,
        propertyCount: otherCount,
        isOther: true,
      },
    ];
  }, [areaData, showAll]);

  const groupByLabel = {
    area: 'Area',
    postcode_area: 'Postcode Area',
    local_authority: 'Local Authority',
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base">Area Exposure</CardTitle>
          
          <div className="flex items-center gap-2">
            {/* Group by selector */}
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupByField)}>
              <SelectTrigger className="w-[140px] h-8 text-xs bg-muted/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="area">By Area</SelectItem>
                <SelectItem value="postcode_area">By Postcode</SelectItem>
                <SelectItem value="local_authority">By LA/County</SelectItem>
              </SelectContent>
            </Select>

            {/* Debug button */}
            <Dialog open={debugOpen} onOpenChange={setDebugOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Bug className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle>Area Exposure Debug View</DialogTitle>
                  <DialogDescription>
                    Inspect the raw per-property breakdown that drives the area exposure chart.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Address</TableHead>
                        <TableHead>Raw {groupByLabel[groupBy]}</TableHead>
                        <TableHead>Normalized</TableHead>
                        <TableHead>Bucket</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {debugData.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs max-w-[200px] truncate">
                            <Link 
                              to={`/properties/${item.id}`}
                              className="text-primary hover:underline"
                            >
                              {item.address}
                            </Link>
                          </TableCell>
                          <TableCell className="text-xs">
                            {item.rawValue || <span className="text-muted-foreground italic">(null)</span>}
                          </TableCell>
                          <TableCell className="text-xs">{item.normalizedValue}</TableCell>
                          <TableCell className="text-xs font-medium">{item.bucket}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-2">
        {displayData.length > 0 ? (
          <>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={displayData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={110}
                    tick={CHART_AXIS_TICK}
                    tickFormatter={(value) => value.length > 15 ? value.slice(0, 15) + '…' : value}
                  />
                  <Tooltip
                    formatter={(value, _name, item) => {
                      const payload = (item as TooltipPayload<number, string>).payload as AreaBucket | undefined;
                      return [
                        formatGBP(Number(value)),
                        `${payload?.propertyCount ?? 0} properties`,
                      ];
                    }}
                    {...CHART_TOOLTIP_STYLE}
                  />
                  <Bar
                    dataKey="value"
                    fill={CHART_COLOURS.primary}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Footer: Show all toggle + Data quality */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              {/* Show all / collapse toggle */}
              {areaData.length > DEFAULT_TOP_N && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAll(!showAll)}
                  className="text-xs h-7 px-2"
                >
                  {showAll ? (
                    <>
                      <ChevronUp className="h-3 w-3 mr-1" />
                      Show Top {DEFAULT_TOP_N}
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      Show All ({areaData.length})
                    </>
                  )}
                </Button>
              )}
              
              {/* Missing area count */}
              {missingCount > 0 && (
                <Link 
                  to="/missing-info"
                  className="flex items-center gap-1.5 text-xs text-warning hover:underline ml-auto"
                >
                  <AlertTriangle className="h-3 w-3" />
                  {missingCount} missing {groupByLabel[groupBy].toLowerCase()}
                </Link>
              )}
            </div>
          </>
        ) : (
          <div className="h-[220px] flex flex-col items-center justify-center text-muted-foreground gap-2">
            <BarChart3 className="h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm">Add properties to see geographic distribution</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
