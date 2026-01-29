import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet, ArrowLeft, ArrowRight, Upload, CheckCircle2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileUploadZone } from '@/components/import/FileUploadZone';
import { ColumnMapper } from '@/components/import/ColumnMapper';
import { ValidationPreview } from '@/components/import/ValidationPreview';
import { ImportStepper } from '@/components/import/ImportStepper';
import { useBatchImport } from '@/hooks/useBatchImport';
import { useToast } from '@/hooks/use-toast';
import { 
  parseCSV, 
  autoDetectMapping, 
  validateAndTransformRows,
  type ParsedCSV,
  type ColumnMapping,
  type ValidatedRow,
  PROPERTY_FIELDS,
} from '@/lib/csvParser';

const STEPS = ['Upload', 'Map Columns', 'Preview', 'Import'];

export default function Import() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const batchImport = useBatchImport();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedCSV, setParsedCSV] = useState<ParsedCSV | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; created: number; updated: number } | null>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    setSelectedFile(file);
    
    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      setParsedCSV(parsed);
      
      // Auto-detect column mappings
      const autoMapping = autoDetectMapping(parsed.headers);
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

  const handleMappingChange = useCallback((newMapping: ColumnMapping) => {
    setMapping(newMapping);
  }, []);

  const handleValidate = useCallback(() => {
    if (!parsedCSV) return;
    
    const validated = validateAndTransformRows(parsedCSV.rows, mapping);
    setValidatedRows(validated);
    setCurrentStep(2);
  }, [parsedCSV, mapping]);

  const handleImport = useCallback(async () => {
    const validRows = validatedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      toast({
        title: 'No valid rows',
        description: 'Please fix validation errors before importing',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await batchImport.mutateAsync(validatedRows);
      setImportResult(result);
      setCurrentStep(3);
      
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
  }, [validatedRows, batchImport, toast]);

  const requiredFieldsMapped = PROPERTY_FIELDS
    .filter(f => f.required)
    .every(f => Object.values(mapping).includes(f.key));

  const validRowCount = validatedRows.filter(r => r.isValid).length;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Import Properties</h1>
          <p className="text-muted-foreground">
            Import new properties or update existing ones from a CSV file. Properties with a valid Property ID will be updated; otherwise, new properties will be created.
          </p>
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
              {currentStep === 0 && 'Upload a CSV file exported from Google Sheets or Excel'}
              {currentStep === 1 && 'Map your CSV columns to property fields'}
              {currentStep === 2 && 'Review the data before importing'}
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
                    Your CSV can include any of these columns (we'll auto-detect them):
                  </p>
                  <ul className="grid grid-cols-2 gap-1 text-sm text-muted-foreground">
                    <li><span className="text-foreground font-medium">Property ID</span> - For updates (from export)</li>
                    <li><span className="text-foreground font-medium">address</span> - Property address *</li>
                    <li><span className="text-foreground font-medium">area</span> - Location/area</li>
                    <li><span className="text-foreground font-medium">postcode</span> - UK postcode</li>
                    <li><span className="text-foreground font-medium">type</span> - Property type</li>
                    <li><span className="text-foreground font-medium">beds</span> - Bedrooms</li>
                    <li><span className="text-foreground font-medium">bathrooms</span> - Bathrooms</li>
                    <li><span className="text-foreground font-medium">value</span> - Current value</li>
                    <li><span className="text-foreground font-medium">mortgage_balance</span> - Outstanding mortgage</li>
                    <li><span className="text-foreground font-medium">annual_rent</span> - Yearly rental income</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2">
                    💡 Tip: Export your existing properties first, make changes in Excel/Sheets, then re-import to update.
                  </p>
                </div>
              </>
            )}

            {/* Step 1: Map Columns */}
            {currentStep === 1 && parsedCSV && (
              <ColumnMapper
                csvHeaders={parsedCSV.headers}
                mapping={mapping}
                onMappingChange={handleMappingChange}
                sampleData={parsedCSV.rows.slice(0, 3)}
              />
            )}

            {/* Step 2: Preview */}
            {currentStep === 2 && (
              <ValidationPreview
                validatedRows={validatedRows}
                mapping={mapping}
              />
            )}

            {/* Step 3: Complete */}
            {currentStep === 3 && importResult && (
              <div className="text-center py-8 space-y-4">
                <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">
                    Import Complete
                  </h3>
                  <p className="text-muted-foreground mt-1">
                    Successfully processed {importResult.success} properties
                  </p>
                  <div className="flex items-center justify-center gap-4 mt-2 text-sm">
                    {importResult.created > 0 && (
                      <span className="text-emerald-500">
                        {importResult.created} created
                      </span>
                    )}
                    {importResult.updated > 0 && (
                      <span className="text-blue-500">
                        {importResult.updated} updated
                      </span>
                    )}
                  </div>
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
                disabled={!requiredFieldsMapped}
              >
                Preview Data
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}

            {currentStep === 2 && (
              <Button 
                onClick={handleImport}
                disabled={validRowCount === 0 || batchImport.isPending}
              >
                {batchImport.isPending ? (
                  'Importing...'
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import {validRowCount} Properties
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
