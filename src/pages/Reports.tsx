import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { FileText, Download, Loader2, CheckCircle2, AlertTriangle, Building2, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { 
  useReportData, 
  useGenerateReport, 
  REPORT_TEMPLATES, 
  validateReportInputs,
  type ReportType 
} from '@/hooks/useReportGeneration';
import type { ReportFilters } from '@/lib/reportPdfGenerator';

type LifecycleFilter = 'core_rental' | 'development' | 'all';

export default function Reports() {
  const { properties, isLoading } = useReportData();
  const generateReport = useGenerateReport();

  // Filters state
  const [lifecycleType, setLifecycleType] = useState<LifecycleFilter>('all');
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(true);
  const [includeAttachments, setIncludeAttachments] = useState(false);
  const [brokerNotes, setBrokerNotes] = useState('');

  // Filter properties based on lifecycle
  const filteredProperties = useMemo(() => {
    if (lifecycleType === 'all') return properties;
    return properties.filter(p => p.lifecycle_type === lifecycleType);
  }, [properties, lifecycleType]);

  // Build filters object
  const filters: ReportFilters = useMemo(() => ({
    lifecycleType,
    propertyIds: selectAll ? 'all' : selectedPropertyIds,
    asOfDate: new Date(),
    includeAttachments,
  }), [lifecycleType, selectAll, selectedPropertyIds, includeAttachments]);

  const handleGenerateReport = async (reportType: ReportType) => {
    const template = REPORT_TEMPLATES.find(t => t.id === reportType);
    if (!template) return;

    const validation = validateReportInputs(template, filters, filteredProperties);
    if (!validation.valid) {
      toast.error(validation.errors[0]);
      return;
    }

    try {
      await generateReport.mutateAsync({
        reportType,
        filters,
        properties: filteredProperties,
        brokerNotes: reportType === 'mortgage_broker_pack' ? brokerNotes : undefined,
      });
      toast.success(`${template.name} generated successfully!`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate report');
    }
  };

  const togglePropertySelection = (propertyId: string) => {
    setSelectAll(false);
    setSelectedPropertyIds(prev => 
      prev.includes(propertyId) 
        ? prev.filter(id => id !== propertyId)
        : [...prev, propertyId]
    );
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground">
            Generate professional PDF reports for compliance, brokers, and stakeholders
          </p>
        </div>

        <Tabs defaultValue="generate" className="space-y-6">
          <TabsList>
            <TabsTrigger value="generate">Generate Reports</TabsTrigger>
            <TabsTrigger value="history">Report History</TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-6">
            {/* Filters Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Report Filters
                </CardTitle>
                <CardDescription>
                  Configure which properties and data to include
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Lifecycle Filter */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Portfolio Type</Label>
                    <Select value={lifecycleType} onValueChange={(v) => setLifecycleType(v as LifecycleFilter)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
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
                    <Switch
                      id="attachments"
                      checked={includeAttachments}
                      onCheckedChange={setIncludeAttachments}
                    />
                    <Label htmlFor="attachments">Include certificate attachments</Label>
                  </div>
                </div>

                <Separator />

                {/* Property Selection */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Property Selection</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectAll(true);
                        setSelectedPropertyIds([]);
                      }}
                    >
                      Select All ({filteredProperties.length})
                    </Button>
                  </div>

                  {selectAll ? (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertDescription>
                        All {filteredProperties.length} {lifecycleType === 'all' ? '' : lifecycleType.replace('_', ' ')} properties selected
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <ScrollArea className="h-40 border rounded-md p-3">
                      <div className="space-y-2">
                        {filteredProperties.map(prop => (
                          <div key={prop.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={prop.id}
                              checked={selectedPropertyIds.includes(prop.id)}
                              onCheckedChange={() => togglePropertySelection(prop.id)}
                            />
                            <label htmlFor={prop.id} className="text-sm flex-1 cursor-pointer">
                              {prop.address_line}
                            </label>
                            <Badge variant="outline" className="text-xs">
                              {prop.lifecycle_type === 'core_rental' ? 'Core' : 'Dev'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}

                  {!selectAll && selectedPropertyIds.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {selectedPropertyIds.length} property(ies) selected
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Report Templates */}
            <div className="grid gap-4 md:grid-cols-2">
              {REPORT_TEMPLATES.map(template => {
                const validation = validateReportInputs(template, filters, filteredProperties);
                const effectiveSelection = selectAll ? filteredProperties.length : selectedPropertyIds.length;
                const canGenerate = template.requiresSingleProperty 
                  ? effectiveSelection === 1 
                  : effectiveSelection > 0;

                return (
                  <Card key={template.id} className={!canGenerate ? 'opacity-60' : ''}>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <span className="text-2xl">{template.icon}</span>
                        {template.name}
                      </CardTitle>
                      <CardDescription>{template.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {template.requiresSingleProperty && effectiveSelection !== 1 && (
                        <Alert variant="destructive" className="py-2">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            Select exactly 1 property for this report
                          </AlertDescription>
                        </Alert>
                      )}

                      {template.id === 'mortgage_broker_pack' && (
                        <div className="space-y-2">
                          <Label htmlFor="broker-notes">Broker Notes (optional)</Label>
                          <Input
                            id="broker-notes"
                            placeholder="Additional notes for the broker..."
                            value={brokerNotes}
                            onChange={(e) => setBrokerNotes(e.target.value)}
                          />
                        </div>
                      )}

                      <Button
                        className="w-full gap-2"
                        disabled={!canGenerate || generateReport.isPending}
                        onClick={() => handleGenerateReport(template.id)}
                      >
                        {generateReport.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        Generate PDF
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Generated Reports</CardTitle>
                <CardDescription>Previously generated reports are logged in the Activity feed</CardDescription>
              </CardHeader>
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Report generation history is tracked in each property's Activity timeline.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
