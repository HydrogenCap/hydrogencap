import { useState, useCallback } from 'react';
import { Upload, Loader2, CheckCircle2, AlertTriangle, RotateCcw, FileText, Bot, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { uploadToStorage, getPublicUrl, removeFromStorage } from '@/hooks/useStorageUpload';
import { invokeEdgeFunction } from '@/hooks/useEdgeFunction';
import { useToast } from '@/hooks/use-toast';
import { useUpdateComplianceItem, useUploadComplianceDocument } from '@/hooks/useCompliance';

interface AIAnalysisResult {
  issueDate: string | null;
  expiryDate: string | null;
  certificateNumber: string | null;
  engineerName: string | null;
  isExpired: boolean;
  daysUntilExpiry: number | null;
  matchesPropertyAddress: boolean;
  issues: { message: string; severity: 'critical' | 'warning' }[];
  confidence: number;
}

interface ComplianceUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  complianceType: string;
  propertyAddress: string;
  propertyId: string;
  complianceItemId?: string;
  isMissing?: boolean;
  onCreateMissingItem?: () => Promise<string | null>;
  onSuccess?: () => void;
}

type UploadStep = 'upload' | 'processing' | 'results';

export function ComplianceUploadDialog({
  open,
  onOpenChange,
  complianceType,
  propertyAddress,
  propertyId,
  complianceItemId,
  isMissing = false,
  onCreateMissingItem,
  onSuccess,
}: ComplianceUploadDialogProps) {
  const [step, setStep] = useState<UploadStep>('upload');
  const [progress, setProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [createdItemId, setCreatedItemId] = useState<string | null>(null);
  const { toast } = useToast();
  
  const uploadDocument = useUploadComplianceDocument();
  const updateComplianceItem = useUpdateComplianceItem();

  const progressSteps = [
    { threshold: 20, label: 'Document uploaded' },
    { threshold: 40, label: 'Text extracted' },
    { threshold: 70, label: 'AI analysis in progress' },
    { threshold: 95, label: 'Validating information' },
  ];

  const resetDialog = useCallback(() => {
    setStep('upload');
    setProgress(0);
    setSelectedFile(null);
    setAnalysisResult(null);
    setIsProcessing(false);
    setCreatedItemId(null);
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file) return;
    
    // Validate file
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF, JPG, or PNG file.',
        variant: 'destructive',
      });
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 10MB.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);
    setStep('processing');
    setIsProcessing(true);
    
    // Simulate progress
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += Math.random() * 15;
      if (currentProgress > 90) currentProgress = 90;
      setProgress(currentProgress);
    }, 500);

    try {
      // Upload file to get URL for AI analysis
      const fileExt = file.name.split('.').pop();
      const tempPath = `temp/${Date.now()}.${fileExt}`;
      
      await uploadToStorage('compliance', tempPath, file);

      const publicUrl = getPublicUrl('compliance', tempPath);

      setProgress(40);

      // Call AI analysis edge function
      const analysisData = await invokeEdgeFunction<{
        extracted_issue_date?: string; expiry_date?: string; extracted_reference_number?: string;
        engineer_name?: string; is_expired?: boolean; days_until_expiry?: number;
        address_match?: boolean; issues?: { message: string; severity: 'critical' | 'warning' }[];
        confidence?: number;
      }>('process-document', {
        documentUrl: publicUrl,
        documentType: complianceType,
        propertyAddress,
        extractMode: 'compliance',
      });

      clearInterval(progressInterval);
      setProgress(100);

      // Clean up temp file
      await removeFromStorage('compliance', [tempPath]);

      // Parse AI response into our format
      const result: AIAnalysisResult = {
        issueDate: analysisData?.extracted_issue_date || null,
        expiryDate: analysisData?.expiry_date || null,
        certificateNumber: analysisData?.extracted_reference_number || null,
        engineerName: analysisData?.engineer_name || null,
        isExpired: analysisData?.is_expired || false,
        daysUntilExpiry: analysisData?.days_until_expiry || null,
        matchesPropertyAddress: analysisData?.address_match !== false,
        issues: analysisData?.issues || [],
        confidence: analysisData?.confidence || 75,
      };

      setAnalysisResult(result);
      setStep('results');
    } catch (error) {
      clearInterval(progressInterval);
      console.error('AI analysis error:', error);
      
      // Fall back to manual entry with placeholder data
      setAnalysisResult({
        issueDate: null,
        expiryDate: null,
        certificateNumber: null,
        engineerName: null,
        isExpired: false,
        daysUntilExpiry: null,
        matchesPropertyAddress: true,
        issues: [{ message: 'Could not extract data automatically. Please verify manually.', severity: 'warning' }],
        confidence: 0,
      });
      setStep('results');
    } finally {
      setIsProcessing(false);
    }
  }, [complianceType, propertyAddress, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleSave = async () => {
    if (!selectedFile || !analysisResult) return;
    
    setIsProcessing(true);
    try {
      // If this is a missing item, create the compliance record first
      let itemId = complianceItemId;
      if (isMissing && onCreateMissingItem) {
        const newItemId = await onCreateMissingItem();
        if (!newItemId) {
          throw new Error('Failed to create compliance record');
        }
        itemId = newItemId;
        setCreatedItemId(newItemId);
      }

      if (!itemId) {
        throw new Error('No compliance item ID');
      }

      // Upload document
      await uploadDocument.mutateAsync({
        complianceItemId: itemId,
        propertyId,
        file: selectedFile,
        complianceType,
        propertyAddress,
      });

      // Update compliance item with extracted dates
      if (analysisResult.expiryDate || analysisResult.issueDate) {
        await updateComplianceItem.mutateAsync({
          id: itemId,
          expiry_date: analysisResult.expiryDate,
          issue_date: analysisResult.issueDate,
        });
      }

      toast({
        title: isMissing ? 'Compliance record created' : 'Document saved',
        description: isMissing 
          ? 'New compliance record has been created successfully.'
          : 'Compliance record has been updated successfully.',
      });
      
      onSuccess?.();
      onOpenChange(false);
      resetDialog();
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: 'Error saving document',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not found';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB');
    } catch {
      return dateStr;
    }
  };

  const getDaysLabel = (days: number | null, isExpired: boolean) => {
    if (days === null) return 'Unknown';
    if (isExpired) return `Expired ${Math.abs(days)} days ago`;
    if (days === 0) return 'Expires today';
    return `Valid for ${days} days`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetDialog(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Upload Compliance Document
          </DialogTitle>
          <DialogDescription>
            {complianceType} for {propertyAddress}
          </DialogDescription>
        </DialogHeader>

        {/* Missing item indicator */}
        {isMissing && step === 'upload' && (
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              This document has not been uploaded yet. Upload a certificate to create a new compliance record.
            </AlertDescription>
          </Alert>
        )}

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors',
              'hover:border-primary hover:bg-muted/50',
              'border-muted-foreground/25'
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Click to upload or drag and drop</p>
            <p className="text-sm text-muted-foreground mt-1">PDF, JPG, PNG (Max 10MB)</p>
            <input
              id="file-upload"
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            />
          </div>
        )}

        {/* Step 2: Processing */}
        {step === 'processing' && (
          <div className="py-8 space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <Bot className="h-12 w-12 text-primary animate-pulse" />
              </div>
              <p className="text-lg font-medium">AI analyzing document...</p>
            </div>
            
            <Progress value={progress} className="h-2" />
            
            <div className="space-y-2">
              {progressSteps.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {progress >= s.threshold ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                  )}
                  <span className={cn(
                    progress >= s.threshold ? 'text-foreground' : 'text-muted-foreground'
                  )}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Results */}
        {step === 'results' && analysisResult && (
          <div className="space-y-4">
            {/* AI Extracted Info */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Bot className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">AI Extracted Information</h3>
                {analysisResult.confidence > 0 && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {analysisResult.confidence}% confidence
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Issue Date</span>
                  <p className="font-medium">{formatDate(analysisResult.issueDate)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Expiry Date</span>
                  <p className="font-medium">{formatDate(analysisResult.expiryDate)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Certificate #</span>
                  <p className="font-medium">{analysisResult.certificateNumber || 'Not found'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Engineer</span>
                  <p className="font-medium">{analysisResult.engineerName || 'Not found'}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Status</span>
                  <p className={cn(
                    'font-medium',
                    analysisResult.isExpired ? 'text-destructive' : 'text-green-600'
                  )}>
                    {getDaysLabel(analysisResult.daysUntilExpiry, analysisResult.isExpired)}
                  </p>
                </div>
              </div>
            </div>

            {/* Issues */}
            {analysisResult.issues.length > 0 && (
              <Alert variant={analysisResult.issues.some(i => i.severity === 'critical') ? 'destructive' : 'default'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Issues Detected</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    {analysisResult.issues.map((issue, i) => (
                      <li key={i} className="text-sm">{issue.message}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={resetDialog} disabled={isProcessing}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Re-scan
              </Button>
              <Button onClick={handleSave} disabled={isProcessing}>
                {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isMissing ? 'Create Record' : 'Save Information'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
