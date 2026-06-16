import { ExternalLink, FileText, Loader2 } from 'lucide-react';
import { PdfCanvasPreview } from '../PdfCanvasPreview';

interface Props {
  fileName?: string | null;
  isPdf: boolean;
  openHref: string | null;
  pdfBlob: Blob | null;
  pdfBlobLoading: boolean;
  pdfBlobError: string | null;
  previewUrl: string | null;
  previewSignedLoading: boolean;
}

export function DocumentPreviewPanel({
  fileName, isPdf, openHref, pdfBlob, pdfBlobLoading, pdfBlobError, previewUrl, previewSignedLoading,
}: Props) {
  return (
    <div className="mb-4 rounded-lg border border-border overflow-hidden bg-muted/30">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground min-w-0">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{fileName || 'Document preview'}</span>
        </div>
        {openHref && (
          <a
            href={openHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
          >
            Open full size
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      <div className="bg-background" style={{ minHeight: 480 }}>
        {isPdf ? (
          pdfBlobLoading && !pdfBlob ? (
            <div className="flex items-center justify-center" style={{ height: 480 }}>
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : pdfBlob ? (
            <PdfCanvasPreview data={pdfBlob} height={480} />
          ) : (
            <div className="flex items-center justify-center p-4 text-center text-sm text-muted-foreground" style={{ height: 480 }}>
              {pdfBlobError || 'PDF preview unavailable.'}{' '}
              {openHref && (
                <a href={openHref} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">
                  Open in new tab
                </a>
              )}
            </div>
          )
        ) : (
          <div className="flex items-center justify-center" style={{ height: 480 }}>
            {previewSignedLoading && !previewUrl ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : previewUrl ? (
              <img
                src={previewUrl}
                alt="Document preview"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <p className="text-xs text-muted-foreground">Preview unavailable</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
