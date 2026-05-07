import { CheckCircle2, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PropertySearchSelect } from '@/components/reports/PropertySearchSelect';
import type { LifecycleFilter, SelectionMode } from '../utils/types';

export function ReportFiltersCard({
  lifecycleType, setLifecycleType,
  selectionMode, setSelectionMode,
  selectedPropertyId, setSelectedPropertyId,
  includeAttachments, setIncludeAttachments,
  lifecycleFilteredProperties, filteredProperties,
}: {
  lifecycleType: LifecycleFilter;
  setLifecycleType: (v: LifecycleFilter) => void;
  selectionMode: SelectionMode;
  setSelectionMode: (v: SelectionMode) => void;
  selectedPropertyId: string | null;
  setSelectedPropertyId: (v: string | null) => void;
  includeAttachments: boolean;
  setIncludeAttachments: (v: boolean) => void;
  lifecycleFilteredProperties: Array<Record<string, unknown>>;
  filteredProperties: Array<Record<string, unknown>>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Report Filters
        </CardTitle>
        <CardDescription>Configure which properties and data to include</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Portfolio Type</Label>
            <Select value={lifecycleType} onValueChange={(v) => setLifecycleType(v as LifecycleFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                <SelectItem value="core_rental">Core Rental Only</SelectItem>
                <SelectItem value="development">Development Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>As of Date</Label>
            <Input type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} disabled />
          </div>
          <div className="flex items-center space-x-2 pt-7">
            <Switch id="attachments" checked={includeAttachments} onCheckedChange={setIncludeAttachments} />
            <Label htmlFor="attachments">Include certificate attachments</Label>
          </div>
        </div>

        <div className="space-y-3">
          <Label>Property Selection</Label>
          <RadioGroup
            value={selectionMode}
            onValueChange={(v) => {
              setSelectionMode(v as SelectionMode);
              if (v === 'all') setSelectedPropertyId(null);
            }}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="all-properties" />
              <Label htmlFor="all-properties" className="font-normal cursor-pointer">
                All Properties ({lifecycleFilteredProperties.length})
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="single" id="single-property" />
              <Label htmlFor="single-property" className="font-normal cursor-pointer">
                Single Property
              </Label>
            </div>
          </RadioGroup>

          {selectionMode === 'single' && (
            <PropertySearchSelect
              properties={lifecycleFilteredProperties as Parameters<typeof PropertySearchSelect>[0]['properties']}
              value={selectedPropertyId || ''}
              onValueChange={setSelectedPropertyId}
            />
          )}
        </div>

        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            {filteredProperties.length} {lifecycleType === 'all' ? '' : lifecycleType.replace('_', ' ')} {filteredProperties.length === 1 ? 'property' : 'properties'} will be included in reports
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
