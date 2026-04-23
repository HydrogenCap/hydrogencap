import { useState, useEffect } from 'react';
import { Download, ExternalLink, FileText, Loader2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { ShareLinkButton } from '@/components/documents/ShareLinkButton';
import { usePdfBlobUrl } from '@/hooks/usePdfBlobUrl';
import { extractStoragePath } from '@/lib/storagePaths';
import { toast } from 'sonner';

interface DocumentViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: {
    id: string;
    file_url: string;
    original_file_name: string;
    file_type: string | null;
    uploaded_at: string;
    version_number: number;
  } | null;
  title?: string;
}

function canPreviewInline(fileType: string | null, fileName: string): boolean {
  if (!fileType && !fileName) return false;
  
  const previewableTypes = [
    'application/pdf',
    'pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ];
  
  if (fileType && previewableTypes.includes(fileType)) return true;
  
  const ext = fileName.split('.').pop()?.toLowerCase();
  const previewableExts = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
  return ext ? previewableExts.includes(ext) : false;
}

function isImageFile(fileType: string | null, fileName: string): boolean {
  if (fileType?.startsWith('image/')) return true;
  const ext = fileName.split('.').pop()?.toLowerCase();
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
  return ext ? imageExts.includes(ext) : false;
}

function isPdfFile(fileType: string | null, fileName: string): boolean {
  if (fileType === 'application/pdf' || fileType === 'pdf') return true;
  const ext = fileName.split('.').pop()?.toLowerCase();
  return ext === 'pdf';
}

export function DocumentViewerModal({ 
  open, 
  onOpenChange, 
  document,
  title 
}: DocumentViewerModalProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPdf = document ? isPdfFile(document.file_type, document.original_file_name) : false;
  const { blobUrl: pdfBlobUrl, dataUrl: pdfDataUrl, loading: pdfLoading, error: pdfError } = usePdfBlobUrl(
    isPdf && signedUrl ? signedUrl : null
  );

  useEffect(() => {
    async function getSignedUrl() {
      if (!document || !open) {
        setSignedUrl(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const path = extractStoragePath('compliance', document.file_url);
        
        if (!path) {
          setSignedUrl(document.file_url);
          setLoading(false);
          return;
        }

        const { data, error: signError } = await supabase.storage
          .from('compliance')
          .createSignedUrl(path, 3600);

        if (signError) {
          console.error('Failed to create signed URL:', signError);
          setSignedUrl(document.file_url);
        } else {
          setSignedUrl(data.signedUrl);
        }
      } catch (err) {
        console.error('Failed to generate signed URL:', err);
        toast.error(err instanceof Error ? err.message : 'Something went wrong');
        setSignedUrl(document.file_url);
      } finally {
        setLoading(false);
      }
    }

    getSignedUrl();
  }, [document, open]);

  if (!document) return null;

  const canPreview = canPreviewInline(document.file_type, document.original_file_name);
  const isImage = isImageFile(document.file_type, document.original_file_name);

  const handleDownload = async () => {
    if (!signedUrl) return;
    
    try {
      const response = await fetch(signedUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.original_file_name;
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      window.document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to download document:', err);
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
      window.open(signedUrl, '_blank');
    }
  };

  const handleOpenInNewTab = () => {
    if (signedUrl) {
      window.open(signedUrl, '_blank');
    }
  };

  const isLoadingAny = loading || (isPdf && pdfLoading && !!signedUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="truncate pr-4">
              {title || document.original_file_name}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <ShareLinkButton complianceDocumentId={document.id} variant="outline" size="sm" />
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={!signedUrl}>
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
              <Button variant="outline" size="sm" onClick={handleOpenInNewTab} disabled={!signedUrl}>
                <ExternalLink className="h-4 w-4 mr-1" />
                Open in New Tab
              </Button>
            </div>
          </div>
          <DialogDescription className="text-sm">
            Version {document.version_number} • {document.original_file_name}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden rounded-lg border bg-muted/30 relative">
          {isLoadingAny ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {loading ? 'Loading document...' : 'Rendering PDF...'}
              </p>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <p className="text-destructive">{error}</p>
              <Button onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download Instead
              </Button>
            </div>
          ) : !canPreview ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
              <FileText className="h-16 w-16 text-muted-foreground" />
              <div>
                <h3 className="font-medium text-lg mb-1">Preview Not Available</h3>
                <p className="text-muted-foreground mb-4">
                  This file type cannot be previewed in the browser.
                </p>
                <Button onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download File
                </Button>
              </div>
            </div>
          ) : isImage && signedUrl ? (
            <div className="absolute inset-0 flex items-center justify-center p-4 overflow-auto">
              <img 
                src={signedUrl} 
                alt={document.original_file_name}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          ) : isPdf && signedUrl ? (
            pdfError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
                <AlertCircle className="h-12 w-12 text-destructive" />
                <p className="text-destructive">{pdfError}</p>
                <div className="flex gap-2">
                  <Button onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Instead
                  </Button>
                  <Button variant="outline" onClick={handleOpenInNewTab}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in New Tab
                  </Button>
                </div>
              </div>
            ) : (pdfBlobUrl || pdfDataUrl) ? (
              <object
                data={`${pdfDataUrl || pdfBlobUrl}#toolbar=1&navpanes=0`}
                type="application/pdf"
                className="w-full h-full"
                title={document.original_file_name}
              >
                <iframe
                  src={`${pdfBlobUrl || pdfDataUrl}#toolbar=1&navpanes=0`}
                  className="w-full h-full border-0"
                  title={document.original_file_name}
                />
              </object>
            ) : null
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
