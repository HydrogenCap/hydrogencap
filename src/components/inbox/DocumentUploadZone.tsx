import { useCallback, useState } from 'react';
import { captureError } from '@/lib/sentry';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useCreateDocument, useUpdateDocument } from '@/hooks/useDocuments';
import { useToast } from '@/hooks/use-toast';
import { fetchUserOrgId as getUserOrgId } from '@/hooks/useUserOrg';

interface DocumentUploadZoneProps {
  onUploadComplete?: () => void;
}

export function DocumentUploadZone({ onUploadComplete }: DocumentUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const createDocument = useCreateDocument();
  const updateDocument = useUpdateDocument();
  const { toast } = useToast();

  const processWithAI = useCallback(async (documentId: string, fileUrl: string, orgId: string) => {
    try {
      const response = await supabase.functions.invoke('process-document-v2', {
        body: { document_url: fileUrl, document_id: documentId, org_id: orgId },
      });

      if (response.error) {
        console.error('AI processing error:', response.error);
        captureError(response.error, 'DocumentUploadZone.aiProcess');
        await updateDocument.mutateAsync({ id: documentId, extraction_status: 'failed' });
      }
    } catch (err) {
      console.error('Failed to process document with AI:', err);
      captureError(err, 'DocumentUploadZone.aiProcess');
      await updateDocument.mutateAsync({ id: documentId, extraction_status: 'failed' }).catch(() => {});
    }
  }, [updateDocument]);

  const uploadFile = useCallback(async (file: File) => {
    const orgId = await getUserOrgId();
    if (!orgId) {
      throw new Error('No organization found. Please log in again.');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${orgId}/${fileName}`;

    setUploadProgress(`Uploading ${file.name}...`);

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (uploadError) {
      throw uploadError;
    }

    const { data: urlData, error: signedUrlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 3600);

    if (signedUrlError || !urlData?.signedUrl) {
      throw new Error('Failed to generate signed URL for document');
    }

    setUploadProgress('Creating document record...');

    const storagePath = filePath;
    const document = await createDocument.mutateAsync({
      file_url: storagePath,
      original_file_name: file.name,
      file_type: (fileExt || '').toLowerCase(),
      file_size_bytes: file.size,
      mime_type: file.type || null,
      extraction_status: 'pending',
      review_status: 'pending',
    });

    setUploadProgress('Queued for AI analysis \u2713');

    // Fire-and-forget — realtime subscription will update the UI
    processWithAI(document.id, urlData.signedUrl, orgId).catch(err => {
      console.error('Background AI processing failed:', err);
    });

    return document;
  }, [createDocument, processWithAI]);

  const handleFiles = useCallback(async (files: FileList) => {
    const validFiles = Array.from(files).filter(file => {
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      return validTypes.includes(file.type);
    });

    if (validFiles.length === 0) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload PDF or image files (JPEG, PNG, WebP)',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      for (const file of validFiles) {
        await uploadFile(file);
      }

      toast({
        title: 'Document uploaded',
        description: 'AI is analysing your document in the background. The inbox will update automatically.',
      });

      onUploadComplete?.();
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  }, [toast, onUploadComplete, uploadFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  if (isUploading) {
    return (
      <div className="border border-border rounded-lg p-8 text-center bg-muted/30">
        <Loader2 className="h-8 w-8 mx-auto mb-3 text-primary animate-spin" />
        <p className="text-foreground font-medium">{uploadProgress || 'Processing...'}</p>
        <p className="text-sm text-muted-foreground mt-1">Please wait while we analyze your documents</p>
      </div>
    );
  }

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
        isDragOver 
          ? 'border-primary bg-primary/5' 
          : 'border-border hover:border-muted-foreground/70'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Upload className={`h-10 w-10 mx-auto mb-3 ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`} />
      <p className="text-foreground font-medium mb-1">
        Drop documents here to upload
      </p>
      <p className="text-sm text-muted-foreground mb-4">
        PDF, JPEG, PNG, or WebP • AI will classify and match to properties
      </p>
      <label>
        <input
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />
        <Button asChild variant="outline">
          <span className="cursor-pointer">
            <FileText className="h-4 w-4 mr-2" />
            Browse Files
          </span>
        </Button>
      </label>
    </div>
  );
}
