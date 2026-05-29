import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { FileUploadZone } from '@/components/import/FileUploadZone';
import { ColumnMapper } from '@/components/import/ColumnMapper';
import { ValidationPreview } from '@/components/import/ValidationPreview';
import { ImportStepper } from '@/components/import/ImportStepper';
import { GeocodePrompt } from '@/components/import/GeocodePrompt';
import { useBatchImport } from '@/hooks/useBatchImport';
import {
  parseCSV,
  autoDetectMapping,
  validateAndTransformRows,
  type ParsedCSV,
  type ColumnMapping,
  type ValidatedRow,
  PROPERTY_FIELDS,
} from '@/lib/csvParser';
import { toast } from "sonner";

const PROPERTY_STEPS = ['Upload', 'Map Columns', 'Preview', 'Import'];

export function ImportPropertiesTab() {
  const navigate = useNavigate();
  const batchImport = useBatchImport();

  const [currentStep, setCurrentStep] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedCSV, setParsedCSV] = useState<ParsedCSV | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    setSelectedFile(file);
    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      setParsedCSV(parsed);
      const autoMapping = autoDetectMapping(parsed.headers);
      setMapping(autoMapping);
      setCurrentStep(1);
    } catch (err) {
      toast.error('Failed to parse CSV', { description: err instanceof Error ? err.message : 'Unknown error' });
    }
  }, []);

  const handleClearFile = useCallback(() => {
    setSelectedFile(null);
    setParsedCSV(null);
    setMapping({});
    setValidatedRows([]);
    setCurrentStep(0);
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
      toast.error('No valid rows', { description: 'Please fix validation errors before importing' });
      return;
    }

    try {
      const result = await batchImport.mutateAsync(validatedRows);
      setImportResult(result);
      setCurrentStep(3);
      toast('Import complete', { description: `Successfully imported ${result.success} properties` });
    } catch (err) {
      toast.error('Import failed', { description: err instanceof Error ? err.message : 'Unknown error' });
    }
  }, [validatedRows, batchImport]);

  const requiredFieldsMapped = PROPERTY_FIELDS
    .filter(f => f.required)
    .every(f => Object.values(mapping).includes(f.key));
  const validRowCount = validatedRows.filter(r => r.isValid).length;

  return (
    <div className="space-y-6 max-w-4xl">
      <ImportStepper currentStep={currentStep} steps={PROPERTY_STEPS} />

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {PROPERTY_STEPS[currentStep]}
          </CardTitle>
          <CardDescription>
            {currentStep === 0 && 'Upload a CSV file exported from Google Sheets or Excel'}
            {currentStep === 1 && 'Map your CSV columns to property fields'}
            {currentStep === 2 && 'Review the data before importing'}
            {currentStep === 3 && 'Import complete'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentStep === 0 && (
            <>
              <FileUploadZone
                onFileSelect={handleFileSelect}
                selectedFile={selectedFile}
                onClear={handleClearFile}
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

          {currentStep === 1 && parsedCSV && (
            <ColumnMapper
              csvHeaders={parsedCSV.headers}
              mapping={mapping}
              onMappingChange={setMapping}
              sampleData={parsedCSV.rows.slice(0, 3)}
            />
          )}

          {currentStep === 2 && (
            <ValidationPreview
              validatedRows={validatedRows}
              mapping={mapping}
            />
          )}

          {currentStep === 3 && importResult && (
            <div className="text-center py-8 space-y-4">
              <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-foreground">Import Complete</h3>
                <p className="text-muted-foreground mt-1">
                  Successfully imported {importResult.success} properties
                </p>
                {importResult.failed > 0 && (
                  <p className="text-destructive text-sm mt-1">
                    {importResult.failed} rows failed to import
                  </p>
                )}
              </div>

              <div className="pt-4">
                <GeocodePrompt
                  importedCount={importResult.success}
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
            <Button onClick={handleValidate} disabled={!requiredFieldsMapped}>
              Preview Data
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}

          {currentStep === 2 && (
            <Button onClick={handleImport} disabled={validRowCount === 0 || batchImport.isPending}>
              {batchImport.isPending ? 'Importing...' : (
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
  );
}
