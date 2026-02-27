import { useCallback, useState } from 'react';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useCreateDocument } from '@/hooks/useDocuments';
import { usePropertiesV2 } from '@/hooks/usePropertiesV2';
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
  const { data: properties } = usePropertiesV2();
  const { toast } = useToast();

  const processWithAI = async (documentId: string, fileUrl: string) => {
    try {
      const propertyList = (properties || []).map(p => ({
        id: p.id,
        address_line: `${p.address_line_1}, ${p.city}`,
        postcode: p.postcode,
      }));

      const response = await supabase.functions.invoke('process-document', {
        body: { documentId, fileUrl, properties: propertyList },
      });

      if (response.error) {
        console.error('AI processing error:', response.error);
        toast({
          title: 'AI processing failed',
          description: 'Document uploaded but AI analysis failed. You can manually classify it.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('AI processing error:', err);
    }
  };

  const uploadFile = async (file: File) => {
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
      .createSignedUrl(filePath, 600);

    if (signedUrlError || !urlData?.signedUrl) {
      throw new Error('Failed to generate signed URL for document');
    }

    setUploadProgress(`Creating document record...`);

    const storagePath = filePath;
    const document = await createDocument.mutateAsync({
      file_url: storagePath,
      original_file_name: file.name,
      extraction_status: 'pending',
      review_status: 'pending',
    });

    setUploadProgress(`Processing with AI...`);

    await processWithAI(document.id, urlData.signedUrl);

    return document;
  };

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
        title: 'Upload complete',
        description: `${validFiles.length} document(s) uploaded and queued for processing`,
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
  }, [createDocument, properties, toast, onUploadComplete]);

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
          : 'border-border hover:border-muted-foreground/50'
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
