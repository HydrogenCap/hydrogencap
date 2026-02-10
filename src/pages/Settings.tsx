import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
 import { User, Building2, Users, FileSpreadsheet, Upload, ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle, MapPin, Shield, Bell, CreditCard } from 'lucide-react';
import { SecuritySettings } from '@/components/settings/SecuritySettings';
import { BeneficialGroupsSettings } from '@/components/settings/BeneficialGroupsSettings';
import { LocationSettingsTab } from '@/components/settings/LocationSettingsTab';
 import { ShareholderManagement } from '@/components/settings/ShareholderManagement';
 import { NotificationSettings } from '@/components/settings/NotificationSettings';
 import { ContractorDirectory } from '@/components/settings/ContractorDirectory';
import { BillingSettings } from '@/components/settings/BillingSettings';
import { FileUploadZone } from '@/components/import/FileUploadZone';
import { ColumnMapper } from '@/components/import/ColumnMapper';
import { ValidationPreview } from '@/components/import/ValidationPreview';
import { ImportStepper } from '@/components/import/ImportStepper';
import { GeocodePrompt } from '@/components/import/GeocodePrompt';
import { useBatchImport } from '@/hooks/useBatchImport';
import { useProperties } from '@/hooks/useProperties';
import { useUpsertPassport } from '@/hooks/usePropertyPassport';
import { useToast } from '@/hooks/use-toast';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { useOrganization, useUpdateOrganization } from '@/hooks/useOrganization';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  parseCSV, 
  autoDetectMapping, 
  validateAndTransformRows,
  type ParsedCSV,
  type ColumnMapping,
  type ValidatedRow,
  PROPERTY_FIELDS,
} from '@/lib/csvParser';
import { 
  parseCSV as parsePassportCSV, 
  autoDetectPassportMapping,
  validateAndTransformPassportRows,
  type PassportColumnMapping,
  type PassportValidatedRow,
  PASSPORT_FIELDS,
} from '@/lib/passportCsvParser';

const PROPERTY_STEPS = ['Upload', 'Map Columns', 'Preview', 'Import'];
const PASSPORT_STEPS = ['Upload', 'Map Columns', 'Match Properties', 'Import'];

export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Read ?tab= from URL
  const urlParams = new URLSearchParams(window.location.search);
  const defaultTab = urlParams.get('tab') || 'profile';

  // Profile and Organization state
  const { data: profile } = useProfile();
  const { data: organization } = useOrganization();
  const updateProfile = useUpdateProfile();
  const updateOrganization = useUpdateOrganization();
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');

  // Sync state with fetched data
  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
  }, [profile?.full_name]);

  useEffect(() => {
    if (organization?.name) setOrgName(organization.name);
  }, [organization?.name]);

  const handleSaveProfile = () => {
    if (!fullName.trim()) {
      toast({ title: 'Name required', description: 'Please enter your full name', variant: 'destructive' });
      return;
    }
    updateProfile.mutate({ full_name: fullName.trim() });
  };

  const handleSaveOrganization = () => {
    if (!organization?.id) return;
    if (!orgName.trim()) {
      toast({ title: 'Name required', description: 'Please enter an organization name', variant: 'destructive' });
      return;
    }
    updateOrganization.mutate({ orgId: organization.id, name: orgName.trim() });
  };

  // Property import state
  const batchImport = useBatchImport();
  const [propCurrentStep, setPropCurrentStep] = useState(0);
  const [propSelectedFile, setPropSelectedFile] = useState<File | null>(null);
  const [propParsedCSV, setPropParsedCSV] = useState<ParsedCSV | null>(null);
  const [propMapping, setPropMapping] = useState<ColumnMapping>({});
  const [propValidatedRows, setPropValidatedRows] = useState<ValidatedRow[]>([]);
  const [propImportResult, setPropImportResult] = useState<{ success: number; failed: number } | null>(null);

  // Passport import state
  const { data: properties } = useProperties();
  const upsertPassport = useUpsertPassport();
  const [passCurrentStep, setPassCurrentStep] = useState(0);
  const [passSelectedFile, setPassSelectedFile] = useState<File | null>(null);
  const [passParsedCSV, setPassParsedCSV] = useState<ParsedCSV | null>(null);
  const [passMapping, setPassMapping] = useState<PassportColumnMapping>({});
  const [passValidatedRows, setPassValidatedRows] = useState<PassportValidatedRow[]>([]);
  const [passImportResult, setPassImportResult] = useState<{ success: number; failed: number } | null>(null);
  const [isPassImporting, setIsPassImporting] = useState(false);

  // Property import handlers
  const handlePropFileSelect = useCallback(async (file: File) => {
    setPropSelectedFile(file);
    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      setPropParsedCSV(parsed);
      const autoMapping = autoDetectMapping(parsed.headers);
      setPropMapping(autoMapping);
      setPropCurrentStep(1);
    } catch (err) {
      toast({
        title: 'Failed to parse CSV',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const handlePropClearFile = useCallback(() => {
    setPropSelectedFile(null);
    setPropParsedCSV(null);
    setPropMapping({});
    setPropValidatedRows([]);
    setPropCurrentStep(0);
  }, []);

  const handlePropValidate = useCallback(() => {
    if (!propParsedCSV) return;
    const validated = validateAndTransformRows(propParsedCSV.rows, propMapping);
    setPropValidatedRows(validated);
    setPropCurrentStep(2);
  }, [propParsedCSV, propMapping]);

  const handlePropImport = useCallback(async () => {
    const validRows = propValidatedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      toast({
        title: 'No valid rows',
        description: 'Please fix validation errors before importing',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await batchImport.mutateAsync(propValidatedRows);
      setPropImportResult(result);
      setPropCurrentStep(3);
      toast({
        title: 'Import complete',
        description: `Successfully imported ${result.success} properties`,
      });
    } catch (err) {
      toast({
        title: 'Import failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [propValidatedRows, batchImport, toast]);

  const propRequiredFieldsMapped = PROPERTY_FIELDS
    .filter(f => f.required)
    .every(f => Object.values(propMapping).includes(f.key));
  const propValidRowCount = propValidatedRows.filter(r => r.isValid).length;

  // Passport import handlers
  const handlePassFileSelect = useCallback(async (file: File) => {
    setPassSelectedFile(file);
    try {
      const text = await file.text();
      const parsed = parsePassportCSV(text);
      setPassParsedCSV(parsed);
      const autoMapping = autoDetectPassportMapping(parsed.headers);
      setPassMapping(autoMapping);
      setPassCurrentStep(1);
    } catch (err) {
      toast({
        title: 'Failed to parse CSV',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const handlePassClearFile = useCallback(() => {
    setPassSelectedFile(null);
    setPassParsedCSV(null);
    setPassMapping({});
    setPassValidatedRows([]);
    setPassCurrentStep(0);
  }, []);

  const handlePassMappingChange = useCallback((csvColumn: string, fieldKey: string) => {
    setPassMapping(prev => ({ ...prev, [csvColumn]: fieldKey as any }));
  }, []);

  const handlePassValidate = useCallback(() => {
    if (!passParsedCSV || !properties) return;
    const validated = validateAndTransformPassportRows(passParsedCSV.rows, passMapping);
    
    validated.forEach(row => {
      if (!row.matchAddress && !row.matchPostcode) return;
      const matchedProperty = properties.find(p => {
        const addressMatch = row.matchAddress && 
          p.address_line.toLowerCase().includes(row.matchAddress.toLowerCase());
        const postcodeMatch = row.matchPostcode && 
          p.postcode?.toLowerCase() === row.matchPostcode.toLowerCase();
        return addressMatch || postcodeMatch;
      });
      
      if (matchedProperty) {
        row.matchedPropertyId = matchedProperty.id;
      } else {
        row.errors.push({ row: 0, field: 'match', message: 'No matching property found' });
        row.isValid = false;
      }
    });
    
    setPassValidatedRows(validated);
    setPassCurrentStep(2);
  }, [passParsedCSV, passMapping, properties]);

  const handlePassImport = useCallback(async () => {
    const validRows = passValidatedRows.filter(r => r.isValid && r.matchedPropertyId);
    if (validRows.length === 0) {
      toast({
        title: 'No valid rows',
        description: 'Please fix matching errors before importing',
        variant: 'destructive',
      });
      return;
    }

    setIsPassImporting(true);
    let success = 0;
    let failed = 0;

    for (const row of validRows) {
      try {
        await upsertPassport.mutateAsync({
          property_id: row.matchedPropertyId!,
          ...row.data as any,
        });
        success++;
      } catch {
        failed++;
      }
    }

    setPassImportResult({ success, failed });
    setPassCurrentStep(3);
    setIsPassImporting(false);
    
    toast({
      title: 'Import complete',
      description: `Successfully imported ${success} passports`,
    });
  }, [passValidatedRows, upsertPassport, toast]);

  const passHasAddressMapping = Object.values(passMapping).includes('address_match') || 
                                Object.values(passMapping).includes('postcode_match');
  const passValidRowCount = passValidatedRows.filter(r => r.isValid && r.matchedPropertyId).length;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage your account, organization, data imports, and beneficial groups</p>
        </div>

        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="organization" className="gap-2">
              <Building2 className="h-4 w-4" />
              Organization
            </TabsTrigger>
            <TabsTrigger value="beneficial-groups" className="gap-2">
              <Users className="h-4 w-4" />
              Beneficial Groups
            </TabsTrigger>
            <TabsTrigger value="import-properties" className="gap-2">
              <Upload className="h-4 w-4" />
              Import Properties
            </TabsTrigger>
            <TabsTrigger value="import-passports" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Import Passports
            </TabsTrigger>
            <TabsTrigger value="locations" className="gap-2">
              <MapPin className="h-4 w-4" />
              Locations
            </TabsTrigger>
             <TabsTrigger value="shareholders" className="gap-2">
               <Shield className="h-4 w-4" />
               Shareholders
             </TabsTrigger>
             <TabsTrigger value="notifications" className="gap-2">
               <Bell className="h-4 w-4" />
               Notifications
             </TabsTrigger>
             <TabsTrigger value="billing" className="gap-2">
               <CreditCard className="h-4 w-4" />
               Billing
             </TabsTrigger>
           </TabsList>

          <TabsContent value="profile" className="space-y-6 max-w-2xl">
            {/* Profile Settings */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile
                </CardTitle>
                <CardDescription>Your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={user?.email || ''}
                    disabled
                    className="bg-muted border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your name"
                    className="bg-input border-border"
                  />
                </div>
                <Button onClick={handleSaveProfile} disabled={updateProfile.isPending}>
                  {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </CardContent>
            </Card>

            {/* Security Settings */}
            <SecuritySettings />
          </TabsContent>

          <TabsContent value="organization" className="space-y-6 max-w-2xl">
            {/* Organization Settings */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Organization
                </CardTitle>
                <CardDescription>Manage your portfolio organization</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organization Name</Label>
                  <Input
                    id="orgName"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="My Portfolio"
                    className="bg-input border-border"
                  />
                </div>
                <Button onClick={handleSaveOrganization} disabled={updateOrganization.isPending}>
                  {updateOrganization.isPending ? 'Updating...' : 'Update Organization'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="beneficial-groups" className="space-y-6">
            <BeneficialGroupsSettings />
          </TabsContent>

          {/* Import Properties Tab */}
          <TabsContent value="import-properties" className="space-y-6 max-w-4xl">
            <ImportStepper currentStep={propCurrentStep} steps={PROPERTY_STEPS} />

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  {PROPERTY_STEPS[propCurrentStep]}
                </CardTitle>
                <CardDescription>
                  {propCurrentStep === 0 && 'Upload a CSV file exported from Google Sheets or Excel'}
                  {propCurrentStep === 1 && 'Map your CSV columns to property fields'}
                  {propCurrentStep === 2 && 'Review the data before importing'}
                  {propCurrentStep === 3 && 'Import complete'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {propCurrentStep === 0 && (
                  <>
                    <FileUploadZone
                      onFileSelect={handlePropFileSelect}
                      selectedFile={propSelectedFile}
                      onClear={handlePropClearFile}
                    />
                    <div className="border border-border rounded-lg p-4 space-y-3">
                      <h4 className="font-medium text-foreground">CSV Format Guide</h4>
                      <p className="text-sm text-muted-foreground">
                        Your CSV can include any of these columns (we'll auto-detect them):
                      </p>
                      <ul className="grid grid-cols-2 gap-1 text-sm text-muted-foreground">
                        <li><span className="text-foreground font-medium">address</span> - Property address *</li>
                        <li><span className="text-foreground font-medium">area</span> - Location/area</li>
                        <li><span className="text-foreground font-medium">postcode</span> - UK postcode</li>
                        <li><span className="text-foreground font-medium">type</span> - Property type</li>
                        <li><span className="text-foreground font-medium">beds</span> - Bedrooms</li>
                        <li><span className="text-foreground font-medium">value</span> - Current value</li>
                        <li><span className="text-foreground font-medium">mortgage_balance</span> - Outstanding mortgage</li>
                        <li><span className="text-foreground font-medium">annual_rent</span> - Yearly rental income</li>
                      </ul>
                    </div>
                  </>
                )}

                {propCurrentStep === 1 && propParsedCSV && (
                  <ColumnMapper
                    csvHeaders={propParsedCSV.headers}
                    mapping={propMapping}
                    onMappingChange={setPropMapping}
                    sampleData={propParsedCSV.rows.slice(0, 3)}
                  />
                )}

                {propCurrentStep === 2 && (
                  <ValidationPreview
                    validatedRows={propValidatedRows}
                    mapping={propMapping}
                  />
                )}

                {propCurrentStep === 3 && propImportResult && (
                  <div className="text-center py-8 space-y-4">
                    <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="h-8 w-8 text-success" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-foreground">Import Complete</h3>
                      <p className="text-muted-foreground mt-1">
                        Successfully imported {propImportResult.success} properties
                      </p>
                      {propImportResult.failed > 0 && (
                        <p className="text-destructive text-sm mt-1">
                          {propImportResult.failed} rows failed to import
                        </p>
                      )}
                    </div>
                    
                    {/* Geocode Prompt */}
                    <div className="pt-4">
                      <GeocodePrompt 
                        importedCount={propImportResult.success} 
                        onComplete={() => {}}
                      />
                    </div>
                    
                    <Button onClick={() => navigate('/properties')} className="mt-4">
                      View Properties
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {propCurrentStep < 3 && (
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => setPropCurrentStep(Math.max(0, propCurrentStep - 1))}
                  disabled={propCurrentStep === 0}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>

                {propCurrentStep === 1 && (
                  <Button onClick={handlePropValidate} disabled={!propRequiredFieldsMapped}>
                    Preview Data
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}

                {propCurrentStep === 2 && (
                  <Button onClick={handlePropImport} disabled={propValidRowCount === 0 || batchImport.isPending}>
                    {batchImport.isPending ? 'Importing...' : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Import {propValidRowCount} Properties
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          {/* Import Passports Tab */}
          <TabsContent value="import-passports" className="space-y-6 max-w-4xl">
            <ImportStepper currentStep={passCurrentStep} steps={PASSPORT_STEPS} />

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  {PASSPORT_STEPS[passCurrentStep]}
                </CardTitle>
                <CardDescription>
                  {passCurrentStep === 0 && 'Upload a CSV file with property passport data'}
                  {passCurrentStep === 1 && 'Map your CSV columns to passport fields'}
                  {passCurrentStep === 2 && 'Review property matching before importing'}
                  {passCurrentStep === 3 && 'Import complete'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {passCurrentStep === 0 && (
                  <>
                    <FileUploadZone
                      onFileSelect={handlePassFileSelect}
                      selectedFile={passSelectedFile}
                      onClear={handlePassClearFile}
                    />
                    <div className="border border-border rounded-lg p-4 space-y-3">
                      <h4 className="font-medium text-foreground">CSV Format Guide</h4>
                      <p className="text-sm text-muted-foreground">
                        Include an <span className="font-medium text-foreground">address</span> or <span className="font-medium text-foreground">postcode</span> column to match properties.
                      </p>
                      <div className="grid grid-cols-2 gap-1 text-sm text-muted-foreground">
                        <span>• Keysafe codes</span>
                        <span>• Meter locations & numbers</span>
                        <span>• Construction type</span>
                        <span>• HMO licence details</span>
                        <span>• Management info</span>
                        <span>• Stop tap location</span>
                      </div>
                    </div>
                  </>
                )}

                {passCurrentStep === 1 && passParsedCSV && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Map each CSV column to a passport field. You must map at least an address or postcode for matching.
                    </p>
                    <div className="border border-border rounded-lg divide-y divide-border max-h-[400px] overflow-y-auto">
                      {passParsedCSV.headers.map(header => (
                        <div key={header} className="flex items-center gap-4 p-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{header}</p>
                            {passParsedCSV.rows[0]?.[header] && (
                              <p className="text-xs text-muted-foreground truncate">
                                e.g. {passParsedCSV.rows[0][header]}
                              </p>
                            )}
                          </div>
                          <Select
                            value={passMapping[header] || ''}
                            onValueChange={(value) => handlePassMappingChange(header, value)}
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="Select field..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Skip this column</SelectItem>
                              {PASSPORT_FIELDS.map(field => (
                                <SelectItem key={field.key} value={field.key}>
                                  {field.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {passCurrentStep === 2 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className="bg-success/10 text-success">
                        {passValidRowCount} matched
                      </Badge>
                      <Badge variant="outline" className="bg-destructive/10 text-destructive">
                        {passValidatedRows.length - passValidRowCount} unmatched
                      </Badge>
                    </div>
                    
                    <div className="border border-border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Status</TableHead>
                            <TableHead>Match Address/Postcode</TableHead>
                            <TableHead>Matched Property</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {passValidatedRows.slice(0, 20).map((row, i) => (
                            <TableRow key={i}>
                              <TableCell>
                                {row.isValid && row.matchedPropertyId ? (
                                  <CheckCircle2 className="h-4 w-4 text-success" />
                                ) : (
                                  <AlertTriangle className="h-4 w-4 text-destructive" />
                                )}
                              </TableCell>
                              <TableCell className="text-sm">
                                {row.matchAddress || row.matchPostcode || '—'}
                              </TableCell>
                              <TableCell className="text-sm">
                                {row.matchedPropertyId ? (
                                  properties?.find(p => p.id === row.matchedPropertyId)?.address_line
                                ) : (
                                  <span className="text-destructive">No match found</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {passValidatedRows.length > 20 && (
                        <p className="text-center text-xs text-muted-foreground py-2">
                          Showing first 20 of {passValidatedRows.length} rows
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {passCurrentStep === 3 && passImportResult && (
                  <div className="text-center py-8 space-y-4">
                    <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="h-8 w-8 text-success" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-foreground">Import Complete</h3>
                      <p className="text-muted-foreground mt-1">
                        Successfully imported {passImportResult.success} property passports
                      </p>
                      {passImportResult.failed > 0 && (
                        <p className="text-destructive text-sm mt-1">
                          {passImportResult.failed} rows failed to import
                        </p>
                      )}
                    </div>
                    <Button onClick={() => navigate('/properties')} className="mt-4">
                      View Properties
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {passCurrentStep < 3 && (
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => setPassCurrentStep(Math.max(0, passCurrentStep - 1))}
                  disabled={passCurrentStep === 0}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>

                {passCurrentStep === 1 && (
                  <Button onClick={handlePassValidate} disabled={!passHasAddressMapping}>
                    Match Properties
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}

                {passCurrentStep === 2 && (
                  <Button onClick={handlePassImport} disabled={passValidRowCount === 0 || isPassImporting}>
                    {isPassImporting ? 'Importing...' : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Import {passValidRowCount} Passports
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          {/* Locations Tab */}
          <TabsContent value="locations" className="space-y-6">
            <LocationSettingsTab />
          </TabsContent>

          {/* Shareholders Tab */}
          <TabsContent value="shareholders" className="space-y-6">
            <ShareholderManagement />
          </TabsContent>

           {/* Notifications Tab */}
           <TabsContent value="notifications" className="space-y-6">
             <NotificationSettings />
             <ContractorDirectory />
           </TabsContent>

           {/* Billing Tab */}
           <TabsContent value="billing" className="space-y-6">
             <BillingSettings />
           </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}