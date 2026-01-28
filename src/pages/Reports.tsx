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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Download, Loader2, CheckCircle2, AlertTriangle, Filter, Trash2, ExternalLink, Clock } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PropertySearchSelect } from '@/components/reports/PropertySearchSelect';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { 
  useReportData, 
  useGenerateReport, 
  REPORT_TEMPLATES, 
  validateReportInputs,
  type ReportType,
  type MortgageBrokerPackData,
} from '@/hooks/useReportGeneration';
import { validateMortgageBrokerPack } from '@/lib/mortgageBrokerPackGenerator';
import { useReportHistory, getReportTypeName, deleteReport } from '@/hooks/useReportHistory';
import type { ReportFilters } from '@/lib/reportPdfGenerator';

type LifecycleFilter = 'core_rental' | 'development' | 'all';
type LoanPurpose = 'refinance' | 'capital_raise' | 'rate_switch' | 'purchase' | '';
type SelectionMode = 'all' | 'single';

export default function Reports() {
  const { properties, portfolioSummary, companies, isLoading } = useReportData();
  const { data: reportHistory, isLoading: historyLoading, refetch: refetchHistory } = useReportHistory();
  const generateReport = useGenerateReport();

  // Filters state
  const [lifecycleType, setLifecycleType] = useState<LifecycleFilter>('all');
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('all');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [includeAttachments, setIncludeAttachments] = useState(false);
  const [brokerNotes, setBrokerNotes] = useState('');
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  // Mortgage Broker Pack specific state
  const [showBrokerPackDialog, setShowBrokerPackDialog] = useState(false);
  const [loanPurpose, setLoanPurpose] = useState<LoanPurpose>('');
  const [targetLoanAmount, setTargetLoanAmount] = useState<string>('');
  const [targetLTV, setTargetLTV] = useState<string>('');
  const [preparedFor, setPreparedFor] = useState<string>('');

  // Filter properties based on lifecycle
  const lifecycleFilteredProperties = useMemo(() => {
    if (lifecycleType === 'all') return properties;
    return properties.filter(p => p.lifecycle_type === lifecycleType);
  }, [properties, lifecycleType]);

  // Final filtered properties based on selection mode
  const filteredProperties = useMemo(() => {
    if (selectionMode === 'single' && selectedPropertyId) {
      return lifecycleFilteredProperties.filter(p => p.id === selectedPropertyId);
    }
    return lifecycleFilteredProperties;
  }, [lifecycleFilteredProperties, selectionMode, selectedPropertyId]);

  // Build filters object - always use all filtered properties
  const filters: ReportFilters = useMemo(() => ({
    lifecycleType,
    propertyIds: 'all',
    asOfDate: new Date(),
    includeAttachments,
  }), [lifecycleType, includeAttachments]);

  // For mortgage broker pack, use first property with a linked company
  const propertyForBrokerPack = useMemo(() => {
    return filteredProperties.find(p => p.legal_owner_company_id) || filteredProperties[0] || null;
  }, [filteredProperties]);

  // Build broker pack data for validation  
  const brokerPackData: MortgageBrokerPackData | null = useMemo(() => {
    if (!propertyForBrokerPack) return null;
    const company = companies?.find(c => c.id === propertyForBrokerPack.legal_owner_company_id);
    return {
      property: propertyForBrokerPack,
      company: company || null,
      portfolioSummary,
      loanPurpose,
      targetLoanAmount: targetLoanAmount ? parseFloat(targetLoanAmount) : null,
      targetLTV: targetLTV ? parseFloat(targetLTV) : null,
      brokerNotes,
      preparedFor,
    };
  }, [propertyForBrokerPack, companies, portfolioSummary, loanPurpose, targetLoanAmount, targetLTV, brokerNotes, preparedFor]);

  // Validate broker pack
  const brokerPackValidation = useMemo(() => {
    if (!brokerPackData) return { canGenerate: false, warnings: [], errors: ['No properties available'] };
    return validateMortgageBrokerPack(brokerPackData);
  }, [brokerPackData]);

  const handleGenerateReport = async (reportType: ReportType) => {
    // For mortgage broker pack, show configuration dialog
    if (reportType === 'mortgage_broker_pack') {
      setShowBrokerPackDialog(true);
      return;
    }

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
        brokerNotes: undefined,
      });
      toast.success(`${template.name} generated successfully!`);
      refetchHistory();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate report');
    }
  };

  const handleGenerateBrokerPack = async () => {
    if (!brokerPackData || !brokerPackValidation.canGenerate) {
      toast.error(brokerPackValidation.errors[0] || 'Please complete all required fields');
      return;
    }

    try {
      await generateReport.mutateAsync({
        reportType: 'mortgage_broker_pack',
        filters,
        properties: filteredProperties,
        brokerNotes,
        brokerPackData,
      });
      toast.success('Mortgage Broker Pack generated successfully!');
      setShowBrokerPackDialog(false);
      refetchHistory();
      // Reset form
      setLoanPurpose('');
      setTargetLoanAmount('');
      setTargetLTV('');
      setPreparedFor('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate report');
    }
  };

  const handleDeleteReport = async (path: string) => {
    try {
      setDeletingPath(path);
      await deleteReport(path);
      toast.success('Report deleted');
      refetchHistory();
    } catch (error) {
      toast.error('Failed to delete report');
    } finally {
      setDeletingPath(null);
    }
  };

  // Get company data for broker pack dialog
  const companyForBrokerPack = useMemo(() => {
    if (!propertyForBrokerPack?.legal_owner_company_id) return null;
    return companies?.find(c => c.id === propertyForBrokerPack.legal_owner_company_id) || null;
  }, [propertyForBrokerPack, companies]);

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

                {/* Property Selection Mode */}
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
                      properties={lifecycleFilteredProperties}
                      value={selectedPropertyId || ''}
                      onValueChange={setSelectedPropertyId}
                    />
                  )}
                </div>

                {/* Properties Included Summary */}
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    {filteredProperties.length} {lifecycleType === 'all' ? '' : lifecycleType.replace('_', ' ')} {filteredProperties.length === 1 ? 'property' : 'properties'} will be included in reports
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Report Templates */}
            <div className="grid gap-4 md:grid-cols-2">
              {REPORT_TEMPLATES.map(template => {
                const canGenerate = filteredProperties.length > 0;
                const isMortgagePack = template.id === 'mortgage_broker_pack';
                const propertyCount = filteredProperties.length;

                return (
                  <Card key={template.id} className={!canGenerate ? 'opacity-60' : ''}>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <span className="text-2xl">{template.icon}</span>
                        {template.name}
                        {isMortgagePack && (
                          <Badge variant="secondary" className="text-xs ml-auto">Lender-Grade</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{template.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Show property count for multi-property reports */}
                      <div className="text-sm text-muted-foreground">
                        {propertyCount} {propertyCount === 1 ? 'property' : 'properties'} selected
                      </div>

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
                        {isMortgagePack ? 'Configure & Generate' : 'Generate PDF'}
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
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Generated Reports
                </CardTitle>
                <CardDescription>Previously generated reports stored in your account</CardDescription>
              </CardHeader>
              <CardContent>
                {historyLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !reportHistory || reportHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No reports generated yet</p>
                    <p className="text-sm mt-1">Generated reports will appear here</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Report Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Generated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportHistory.map((report) => (
                        <TableRow key={report.path}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="truncate max-w-[200px]">{report.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {getReportTypeName(report.report_type).replace(' Report', '').replace(' Pack', '')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {report.download_url && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  asChild
                                >
                                  <a href={report.download_url} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteReport(report.path)}
                                disabled={deletingPath === report.path}
                              >
                                {deletingPath === report.path ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Mortgage Broker Pack Configuration Dialog */}
        <Dialog open={showBrokerPackDialog} onOpenChange={setShowBrokerPackDialog}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="text-2xl">🏦</span>
                Mortgage Broker Pack Configuration
              </DialogTitle>
              <DialogDescription>
                Configure the lender-grade documentation pack for {propertyForBrokerPack?.address_line}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Validation Errors */}
              {brokerPackValidation.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="list-disc ml-4 text-sm">
                      {brokerPackValidation.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Validation Warnings */}
              {brokerPackValidation.warnings.length > 0 && (
                <Alert className="border-warning/50 bg-warning/10">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <AlertDescription className="text-warning">
                    <p className="font-medium mb-1">Optional items missing:</p>
                    <ul className="list-disc ml-4 text-sm">
                      {brokerPackValidation.warnings.map((warn, i) => (
                        <li key={i}>{warn}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Loan Purpose */}
              <div className="space-y-2">
                <Label htmlFor="loan-purpose">Loan Purpose *</Label>
                <Select value={loanPurpose} onValueChange={(v) => setLoanPurpose(v as LoanPurpose)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select loan purpose..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="refinance">Refinance</SelectItem>
                    <SelectItem value="capital_raise">Capital Raise</SelectItem>
                    <SelectItem value="rate_switch">Rate Switch</SelectItem>
                    <SelectItem value="purchase">Purchase</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Target Loan Amount */}
                <div className="space-y-2">
                  <Label htmlFor="target-loan">Target Loan Amount (£)</Label>
                  <Input
                    id="target-loan"
                    type="number"
                    placeholder="e.g. 150000"
                    value={targetLoanAmount}
                    onChange={(e) => setTargetLoanAmount(e.target.value)}
                  />
                </div>

                {/* Target LTV */}
                <div className="space-y-2">
                  <Label htmlFor="target-ltv">Target LTV (%)</Label>
                  <Input
                    id="target-ltv"
                    type="number"
                    placeholder="e.g. 75"
                    value={targetLTV}
                    onChange={(e) => setTargetLTV(e.target.value)}
                  />
                </div>
              </div>

              {/* Prepared For */}
              <div className="space-y-2">
                <Label htmlFor="prepared-for">Prepared For</Label>
                <Input
                  id="prepared-for"
                  placeholder="Broker name or lender..."
                  value={preparedFor}
                  onChange={(e) => setPreparedFor(e.target.value)}
                />
              </div>

              {/* Broker Notes */}
              <div className="space-y-2">
                <Label htmlFor="broker-notes-dialog">Additional Notes</Label>
                <Textarea
                  id="broker-notes-dialog"
                  placeholder="Any additional information for the broker..."
                  value={brokerNotes}
                  onChange={(e) => setBrokerNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Entity Summary */}
              {companyForBrokerPack && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-1 text-sm">
                  <p className="font-medium">Borrowing Entity</p>
                  <p className="text-muted-foreground">{companyForBrokerPack.legal_name}</p>
                  {companyForBrokerPack.company_number && (
                    <p className="text-muted-foreground text-xs">Company No: {companyForBrokerPack.company_number}</p>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBrokerPackDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleGenerateBrokerPack}
                disabled={!brokerPackValidation.canGenerate || generateReport.isPending}
              >
                {generateReport.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Generate Pack
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
