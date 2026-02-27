import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet, ArrowLeft, ArrowRight, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileUploadZone } from '@/components/import/FileUploadZone';
import { ImportStepper } from '@/components/import/ImportStepper';
import { useToast } from '@/hooks/use-toast';
import { usePropertiesCompat as useProperties } from '@/hooks/usePropertiesCompat';
import { useUpsertPassport } from '@/hooks/usePropertyPassport';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  parseCSV, 
  autoDetectPassportMapping,
  validateAndTransformPassportRows,
  type ParsedCSV,
  type PassportColumnMapping,
  type PassportValidatedRow,
  PASSPORT_FIELDS,
} from '@/lib/passportCsvParser';

const STEPS = ['Upload', 'Map Columns', 'Match Properties', 'Import'];

export default function ImportPassport() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: properties } = useProperties();
  const upsertPassport = useUpsertPassport();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedCSV, setParsedCSV] = useState<ParsedCSV | null>(null);
  const [mapping, setMapping] = useState<PassportColumnMapping>({});
  const [validatedRows, setValidatedRows] = useState<PassportValidatedRow[]>([]);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleFileSelect = useCallback(async (file: File) => {
    setSelectedFile(file);
    
    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      setParsedCSV(parsed);
      
      // Auto-detect column mappings
      const autoMapping = autoDetectPassportMapping(parsed.headers);
      setMapping(autoMapping);
      
      // Move to mapping step
      setCurrentStep(1);
    } catch (err) {
      toast({
        title: 'Failed to parse CSV',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const handleClearFile = useCallback(() => {
    setSelectedFile(null);
    setParsedCSV(null);
    setMapping({});
    setValidatedRows([]);
    setCurrentStep(0);
  }, []);

  const handleMappingChange = useCallback((csvColumn: string, fieldKey: string) => {
    setMapping(prev => ({ ...prev, [csvColumn]: fieldKey as any }));
  }, []);

  const handleValidate = useCallback(() => {
    if (!parsedCSV || !properties) return;
    
    const validated = validateAndTransformPassportRows(parsedCSV.rows, mapping);
    
    // Try to match properties
    validated.forEach(row => {
      if (!row.matchAddress && !row.matchPostcode) return;
      
      // Find matching property
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
    
    setValidatedRows(validated);
    setCurrentStep(2);
  }, [parsedCSV, mapping, properties]);

  const handleImport = useCallback(async () => {
    const validRows = validatedRows.filter(r => r.isValid && r.matchedPropertyId);
    if (validRows.length === 0) {
      toast({
        title: 'No valid rows',
        description: 'Please fix matching errors before importing',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);
    let success = 0;
    let failed = 0;

    for (const row of validRows) {
      try {
        await upsertPassport.mutateAsync({
          property_id: row.matchedPropertyId!,
          ...row.data as any,
        });
        success++;
      } catch (err) {
        console.error('Failed to import passport row:', err);
        failed++;
      }
    }

    setImportResult({ success, failed });
    setCurrentStep(3);
    setIsImporting(false);
    
    toast({
      title: 'Import complete',
      description: `Successfully imported ${success} passports`,
    });
  }, [validatedRows, upsertPassport, toast]);

  const hasAddressMapping = Object.values(mapping).includes('address_match') || 
                            Object.values(mapping).includes('postcode_match');
  const validRowCount = validatedRows.filter(r => r.isValid && r.matchedPropertyId).length;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Import Property Passport</h1>
          <p className="text-muted-foreground">Import stock condition data from CSV</p>
        </div>

        {/* Stepper */}
        <ImportStepper currentStep={currentStep} steps={STEPS} />

        {/* Step Content */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              {STEPS[currentStep]}
            </CardTitle>
            <CardDescription>
              {currentStep === 0 && 'Upload a CSV file with property passport data'}
              {currentStep === 1 && 'Map your CSV columns to passport fields'}
              {currentStep === 2 && 'Review property matching before importing'}
              {currentStep === 3 && 'Import complete'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 0: Upload */}
            {currentStep === 0 && (
              <>
                <FileUploadZone
                  onFileSelect={handleFileSelect}
                  selectedFile={selectedFile}
                  onClear={handleClearFile}
                />
                
                {/* Instructions */}
                <div className="border border-border rounded-lg p-4 space-y-3">
                  <h4 className="font-medium text-foreground">CSV Format Guide</h4>
                  <p className="text-sm text-muted-foreground">
                    Include an <span className="font-medium text-foreground">address</span> or <span className="font-medium text-foreground">postcode</span> column to match properties. Other columns will be mapped to passport fields.
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

            {/* Step 1: Map Columns */}
            {currentStep === 1 && parsedCSV && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Map each CSV column to a passport field. You must map at least an address or postcode for matching.
                </p>
                <div className="border border-border rounded-lg divide-y divide-border max-h-[400px] overflow-y-auto">
                  {parsedCSV.headers.map(header => (
                    <div key={header} className="flex items-center gap-4 p-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{header}</p>
                        {parsedCSV.rows[0]?.[header] && (
                          <p className="text-xs text-muted-foreground truncate">
                            e.g. {parsedCSV.rows[0][header]}
                          </p>
                        )}
                      </div>
                      <Select
                        value={mapping[header] || '__skip__'}
                        onValueChange={(value) => handleMappingChange(header, value === '__skip__' ? '' : value)}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Skip this column" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__skip__">Skip this column</SelectItem>
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

            {/* Step 2: Match Properties */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="bg-success/10 text-success">
                    {validRowCount} matched
                  </Badge>
                  <Badge variant="outline" className="bg-destructive/10 text-destructive">
                    {validatedRows.length - validRowCount} unmatched
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
                      {validatedRows.slice(0, 20).map((row, i) => (
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
                  {validatedRows.length > 20 && (
                    <p className="text-center text-xs text-muted-foreground py-2">
                      Showing first 20 of {validatedRows.length} rows
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Complete */}
            {currentStep === 3 && importResult && (
              <div className="text-center py-8 space-y-4">
                <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">
                    Import Complete
                  </h3>
                  <p className="text-muted-foreground mt-1">
                    Successfully imported {importResult.success} property passports
                  </p>
                  {importResult.failed > 0 && (
                    <p className="text-destructive text-sm mt-1">
                      {importResult.failed} rows failed to import
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

        {/* Navigation Buttons */}
        {currentStep < 3 && (
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            {currentStep === 1 && (
              <Button 
                onClick={handleValidate}
                disabled={!hasAddressMapping}
              >
                Match Properties
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}

            {currentStep === 2 && (
              <Button 
                onClick={handleImport}
                disabled={validRowCount === 0 || isImporting}
              >
                {isImporting ? (
                  'Importing...'
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import {validRowCount} Passports
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
