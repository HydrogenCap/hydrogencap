import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Upload, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { FileUploadZone } from '@/components/import/FileUploadZone';
import { ImportStepper } from '@/components/import/ImportStepper';
import { PassportColumnMapper } from '@/components/settings/PassportColumnMapper';
import { PassportMatchPreview } from '@/components/settings/PassportMatchPreview';
import { usePropertiesCompat as useProperties } from '@/hooks/usePropertiesCompat';
import { useUpsertPassport } from '@/hooks/usePropertyPassport';
import { useToast } from '@/hooks/use-toast';
import type { Database as SupabaseDatabase } from '@/integrations/supabase/types';
import {
  parseCSV as parsePassportCSV,
  autoDetectPassportMapping,
  validateAndTransformPassportRows,
  type ParsedCSV,
  type PassportColumnMapping,
  type PassportValidatedRow,
} from '@/lib/passportCsvParser';

const PASSPORT_STEPS = ['Upload', 'Map Columns', 'Match Properties', 'Import'];

type PropertyPassportInsert = SupabaseDatabase['public']['Tables']['property_passport']['Insert'];

export function ImportPassportsTab() {
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
      const parsed = parsePassportCSV(text);
      setParsedCSV(parsed);
      const autoMapping = autoDetectPassportMapping(parsed.headers);
      setMapping(autoMapping);
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

  const handleMappingChange = useCallback((csvColumn: string, fieldKey: PassportColumnMapping[string]) => {
    setMapping(prev => ({ ...prev, [csvColumn]: fieldKey }));
  }, []);

  const handleValidate = useCallback(() => {
    if (!parsedCSV || !properties) return;
    const validated = validateAndTransformPassportRows(parsedCSV.rows, mapping);

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
          ...(row.data as PropertyPassportInsert),
        });
        success++;
      } catch {
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
    <div className="space-y-6 max-w-4xl">
      <ImportStepper currentStep={currentStep} steps={PASSPORT_STEPS} />

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {PASSPORT_STEPS[currentStep]}
          </CardTitle>
          <CardDescription>
            {currentStep === 0 && 'Upload a CSV file with property passport data'}
            {currentStep === 1 && 'Map your CSV columns to passport fields'}
            {currentStep === 2 && 'Review property matching before importing'}
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

          {currentStep === 1 && parsedCSV && (
            <PassportColumnMapper
              parsedCSV={parsedCSV}
              mapping={mapping}
              onMappingChange={handleMappingChange}
            />
          )}

          {currentStep === 2 && (
            <PassportMatchPreview
              validatedRows={validatedRows}
              validRowCount={validRowCount}
              properties={properties}
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
            <Button onClick={handleValidate} disabled={!hasAddressMapping}>
              Match Properties
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}

          {currentStep === 2 && (
            <Button onClick={handleImport} disabled={validRowCount === 0 || isImporting}>
              {isImporting ? 'Importing...' : (
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
  );
}
