import { useState, useEffect, useRef } from 'react';
import { Download, ExternalLink, X, FileText, Loader2, AlertCircle, Link2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { ShareLinkButton } from '@/components/documents/ShareLinkButton';

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

/**
 * Extract storage path from a Supabase storage URL
 */
function extractStoragePath(fileUrl: string): string | null {
  // Pattern: .../storage/v1/object/public/compliance/...
  const publicMatch = fileUrl.match(/\/storage\/v1\/object\/public\/compliance\/(.+)$/);
  if (publicMatch) return publicMatch[1];
  
  // Pattern: .../storage/v1/object/sign/compliance/...
  const signedMatch = fileUrl.match(/\/storage\/v1\/object\/sign\/compliance\/(.+?)(\?|$)/);
  if (signedMatch) return signedMatch[1];
  
  // Try to extract just the path after 'compliance/'
  const simpleMatch = fileUrl.match(/compliance\/(.+?)(\?|$)/);
  if (simpleMatch) return simpleMatch[1];
  
  return null;
}

/**
 * Determine if a file type can be previewed inline
 */
function canPreviewInline(fileType: string | null, fileName: string): boolean {
  if (!fileType && !fileName) return false;
  
  const previewableTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ];
  
  if (fileType && previewableTypes.includes(fileType)) return true;
  
  // Fallback to extension check
  const ext = fileName.split('.').pop()?.toLowerCase();
  const previewableExts = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
  return ext ? previewableExts.includes(ext) : false;
}

/**
 * Check if file is an image
 */
function isImageFile(fileType: string | null, fileName: string): boolean {
  if (fileType?.startsWith('image/')) return true;
  
  const ext = fileName.split('.').pop()?.toLowerCase();
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
  return ext ? imageExts.includes(ext) : false;
}

/**
 * Check if file is a PDF
 */
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
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    
    // Clean up previous blob URL
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
      setBlobUrl(null);
    }

    async function getSignedUrl() {
      if (!document || !open) {
        setSignedUrl(null);
        setBlobUrl(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const path = extractStoragePath(document.file_url);
        
        if (!path) {
          setSignedUrl(document.file_url);
          setLoading(false);
          return;
        }

        const { data, error: signError } = await supabase.storage
          .from('compliance')
          .createSignedUrl(path, 3600);

        if (cancelled) return;

        if (signError) {
          console.error('Failed to create signed URL:', signError);
          setSignedUrl(document.file_url);
        } else {
          setSignedUrl(data.signedUrl);
          
          // For PDFs, fetch as blob to bypass Content-Disposition: attachment
          if (isPdfFile(document.file_type, document.original_file_name)) {
            try {
              const response = await fetch(data.signedUrl);
              if (cancelled) return;
              const pdfBlob = await response.blob();
              // Ensure correct MIME type for PDF rendering
              const typedBlob = pdfBlob.type === 'application/pdf' 
                ? pdfBlob 
                : new Blob([pdfBlob], { type: 'application/pdf' });
              const objectUrl = URL.createObjectURL(typedBlob);
              blobUrlRef.current = objectUrl;
              if (!cancelled) {
                setBlobUrl(objectUrl);
              }
            } catch (fetchErr) {
              console.error('Failed to fetch PDF blob:', fetchErr);
            }
          }
        }
      } catch (err) {
        console.error('Error getting signed URL:', err);
        if (!cancelled) setSignedUrl(document.file_url);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    getSignedUrl();
    
    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [document, open]);

  if (!document) return null;

  const canPreview = canPreviewInline(document.file_type, document.original_file_name);
  const isImage = isImageFile(document.file_type, document.original_file_name);
  const isPdf = isPdfFile(document.file_type, document.original_file_name);

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
      // Fallback: open in new tab
      window.open(signedUrl, '_blank');
    }
  };

  const handleOpenInNewTab = () => {
    if (signedUrl) {
      window.open(signedUrl, '_blank');
    }
  };

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
          <p className="text-sm text-muted-foreground">
            Version {document.version_number} • {document.original_file_name}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-hidden rounded-lg border bg-muted/30 relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
          ) : isPdf && (blobUrl || signedUrl) ? (
            <iframe
              src={`${blobUrl || signedUrl}#toolbar=1&navpanes=0`}
              className="w-full h-full border-0"
              title={document.original_file_name}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
