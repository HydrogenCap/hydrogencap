import { useCallback, useState } from 'react';
import { Upload, FileText, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useUploadManagedDocument } from '@/hooks/useDocumentManagement';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface VaultUploadZoneProps {
  propertyId?: string;
  companyId?: string;
  onUploadComplete?: () => void;
}

export function VaultUploadZone({ propertyId, companyId, onUploadComplete }: VaultUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const uploadDocument = useUploadManagedDocument();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFiles = useCallback(async (files: FileList) => {
    const validTypes = [
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ];

    const validFiles = Array.from(files).filter(f => validTypes.includes(f.type));

    if (validFiles.length === 0) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload PDF, image, Word, or Excel files.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        setUploadProgress(`Uploading ${i + 1}/${validFiles.length}: ${file.name}...`);

        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');

        await uploadDocument.mutateAsync({
          file,
          displayName: nameWithoutExt,
          category: 'other',
          propertyId,
          companyId,
        });
      }

      // Run AI categorise + rename after upload
      setUploadProgress('Running AI categorisation & renaming...');

      const { data, error } = await supabase.functions.invoke('categorise-documents', {
        body: { dryRun: false },
      });

      const parts: string[] = [];
      if (!error && data) {
        if (data.categorised > 0) parts.push(`${data.categorised} categorised`);
        if (data.renamed > 0) parts.push(`${data.renamed} renamed`);
      }

      toast({
        title: 'Upload complete',
        description: `${validFiles.length} document${validFiles.length !== 1 ? 's' : ''} uploaded${parts.length > 0 ? ` • ${parts.join(', ')}` : ''}`,
      });

      queryClient.invalidateQueries({ queryKey: ['document-vault'] });
      queryClient.invalidateQueries({ queryKey: ['document-vault-summaries'] });
      queryClient.invalidateQueries({ queryKey: ['managed-documents'] });
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
  }, [uploadDocument, propertyId, companyId, toast, queryClient, onUploadComplete]);

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
        <p className="text-sm text-muted-foreground mt-1">
          AI will automatically categorise and rename your documents
        </p>
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
      <p className="text-sm text-muted-foreground mb-1">
        PDF, Images, Word, Excel up to 50MB
      </p>
      <p className="text-xs text-muted-foreground mb-4 flex items-center justify-center gap-1">
        <Sparkles className="h-3 w-3" />
        AI will automatically categorise and rename uploaded documents
      </p>
      <label>
        <input
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp,.doc,.docx,.xls,.xlsx,.csv"
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
