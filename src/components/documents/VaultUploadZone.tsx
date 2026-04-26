import { useCallback, useState } from 'react';
import { Upload, FileText, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { useUploadManagedDocument } from '@/hooks/useDocumentManagement';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { fetchUserOrgId as getUserOrgId } from '@/hooks/useUserOrg';
import { createSignedStorageUrl } from '@/lib/storagePaths';

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

    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

    const validFiles = Array.from(files).filter(f => validTypes.includes(f.type));

    if (validFiles.length === 0) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload PDF, image, Word, or Excel files.',
        variant: 'destructive',
      });
      return;
    }

    const oversizedFiles = validFiles.filter(f => f.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      toast({
        title: 'File too large',
        description: `${oversizedFiles.map(f => f.name).join(', ')} exceed${oversizedFiles.length === 1 ? 's' : ''} the 50MB limit.`,
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      const orgId = await getUserOrgId();

      // Check for duplicates before uploading
      const fileNames = validFiles.map(f => f.name);
      const { data: existingDocs } = await supabaseAny
        .from('documents')
        .select('original_file_name, property_id')
        .eq('org_id', orgId!)
        .is('deleted_at', null)
        .in('original_file_name', fileNames);

      const existingSet = new Set(
        (existingDocs || []).map(d => `${d.original_file_name}|${d.property_id || ''}`)
      );

      const duplicates: string[] = [];
      const newFiles: File[] = [];

      for (const file of validFiles) {
        const key = `${file.name}|${propertyId || ''}`;
        if (existingSet.has(key)) {
          duplicates.push(file.name);
        } else {
          newFiles.push(file);
        }
      }

      if (duplicates.length > 0) {
        toast({
          title: `${duplicates.length} duplicate${duplicates.length > 1 ? 's' : ''} skipped`,
          description: duplicates.length <= 3
            ? duplicates.join(', ')
            : `${duplicates.slice(0, 2).join(', ')} and ${duplicates.length - 2} more`,
          variant: 'destructive',
        });
      }

      if (newFiles.length === 0) {
        setIsUploading(false);
        setUploadProgress(null);
        return;
      }

      const uploadedDocs: Array<{ id: string; file_url: string; org_id: string }> = [];
      for (let i = 0; i < newFiles.length; i++) {
        const file = newFiles[i];
        setUploadProgress(`Uploading ${i + 1}/${newFiles.length}: ${file.name}...`);

        const created = await uploadDocument.mutateAsync({
          file,
          displayName: file.name,
          category: 'other',
          propertyId,
          companyId,
        });
        if (created?.id) {
          uploadedDocs.push({
            id: created.id,
            file_url: created.file_url,
            org_id: created.org_id,
          });
        }
      }

      // Fire AI extraction (process-document-v2) per uploaded doc.
      // Best-effort: failures are logged + flipped to 'failed' inside the edge function;
      // they should never block the upload UX.
      setUploadProgress('Queuing AI analysis…');
      await Promise.allSettled(
        uploadedDocs.map(async (doc) => {
          try {
            const signedUrl = await createSignedStorageUrl('documents', doc.file_url, 3600);
            const { error: extErr } = await supabase.functions.invoke('process-document-v2', {
              body: {
                document_url: signedUrl,
                document_id: doc.id,
                org_id: doc.org_id,
              },
            });
            if (extErr) {
              console.error(`process-document-v2 failed for ${doc.id}:`, extErr);
              await supabaseAny
                .from('documents')
                .update({ extraction_status: 'failed' })
                .eq('id', doc.id);
            }
          } catch (err) {
            console.error(`process-document-v2 invocation error for ${doc.id}:`, err);
            await supabaseAny
              .from('documents')
              .update({ extraction_status: 'failed' })
              .eq('id', doc.id)
              .then(() => undefined, () => undefined);
          }
        })
      );

      // Run categorise-documents AFTER extraction so display names reflect AI doc_type.
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
      console.error('Failed to upload documents to vault:', err);
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
