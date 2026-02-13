import { format } from 'date-fns';
import { 
  X, Download, Pencil, Trash2, ExternalLink, 
  FileText, Eye, Loader2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { type ManagedDocument, useDocumentActivity } from '@/hooks/useDocumentManagement';
import { usePdfBlobUrl } from '@/hooks/usePdfBlobUrl';
import { ValuationSummaryInline } from './ValuationSummaryInline';

interface DocumentViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: ManagedDocument;
  onEdit: () => void;
  onDownload: () => void;
  onDelete: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function DocumentViewer({
  open,
  onOpenChange,
  document,
  onEdit,
  onDownload,
  onDelete,
}: DocumentViewerProps) {
  const { data: activity } = useDocumentActivity(document.id);

  const isPdf = document.file_type === 'pdf' || 
    document.file_type === 'application/pdf' ||
    document.original_file_name?.toLowerCase().endsWith('.pdf');

  const { blobUrl: pdfBlobUrl, dataUrl: pdfDataUrl, loading: pdfLoading, error: pdfError } = usePdfBlobUrl(
    isPdf && open ? document.file_url : null
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] p-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">{document.display_name || document.original_file_name}</h2>
            <p className="text-sm text-muted-foreground">
              {document.category} • {formatBytes(document.file_size_bytes || 0)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open(document.file_url, '_blank')}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Preview */}
          <div className="flex-1 bg-muted/30 flex items-center justify-center overflow-auto p-4">
            {document.file_type === 'image' ? (
              <img
                src={document.file_url}
                alt={document.display_name || document.original_file_name}
                className="max-w-full max-h-full object-contain"
              />
            ) : isPdf ? (
              pdfLoading ? (
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Loading PDF...</p>
                </div>
              ) : pdfError ? (
                <div className="text-center">
                  <FileText className="h-24 w-24 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="text-muted-foreground mb-4">Failed to load PDF preview</p>
                  <Button onClick={onDownload}>
                    <Download className="h-4 w-4 mr-2" />
                    Download to View
                  </Button>
                </div>
              ) : (pdfBlobUrl || pdfDataUrl) ? (
                <iframe
                  src={`${pdfBlobUrl || pdfDataUrl}#view=FitH`}
                  className="w-full h-full border-0"
                  title={document.display_name || document.original_file_name}
                />
                
              ) : null
            ) : (
              <div className="text-center">
                <FileText className="h-24 w-24 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-muted-foreground mb-4">
                  Preview not available for this file type
                </p>
                <Button onClick={onDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download to View
                </Button>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <ScrollArea className="w-80 border-l shrink-0">
            <div className="p-4">
              <h3 className="font-medium mb-4">Document Details</h3>

              {/* AI Valuation Summary */}
              {document.category === 'valuations' && (
                <div className="mb-4">
                  <ValuationSummaryInline documentId={document.id} />
                </div>
              )}

              <div className="space-y-4">
                {/* Description */}
                {document.description && (
                  <div>
                    <label className="text-xs text-muted-foreground">Description</label>
                    <p className="text-sm">{document.description}</p>
                  </div>
                )}

                {/* Category */}
                <div>
                  <label className="text-xs text-muted-foreground">Category</label>
                  <p className="text-sm capitalize">{document.category}</p>
                </div>

                {/* File Info */}
                <div>
                  <label className="text-xs text-muted-foreground">File Name</label>
                  <p className="text-sm truncate">{document.original_file_name}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Size</label>
                    <p className="text-sm">{formatBytes(document.file_size_bytes || 0)}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Type</label>
                    <p className="text-sm uppercase">{document.file_type}</p>
                  </div>
                </div>

                {/* Dates */}
                {document.document_date && (
                  <div>
                    <label className="text-xs text-muted-foreground">Document Date</label>
                    <p className="text-sm">{format(new Date(document.document_date), 'dd MMMM yyyy')}</p>
                  </div>
                )}

                {document.expiry_date && (
                  <div>
                    <label className="text-xs text-muted-foreground">Expiry Date</label>
                    <p className="text-sm">{format(new Date(document.expiry_date), 'dd MMMM yyyy')}</p>
                  </div>
                )}

                {/* Tags */}
                {document.tags && document.tags.length > 0 && (
                  <div>
                    <label className="text-xs text-muted-foreground">Tags</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {document.tags.map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Visibility */}
                <div>
                  <label className="text-xs text-muted-foreground">Visibility</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {document.is_confidential && (
                      <Badge variant="destructive" className="text-xs">Confidential</Badge>
                    )}
                    {document.visible_to_shareholders && (
                      <Badge variant="secondary" className="text-xs">Shareholders</Badge>
                    )}
                    {document.visible_to_tenants && (
                      <Badge variant="secondary" className="text-xs">Tenants</Badge>
                    )}
                    {!document.is_confidential && !document.visible_to_shareholders && !document.visible_to_tenants && (
                      <Badge variant="outline" className="text-xs">Internal</Badge>
                    )}
                  </div>
                </div>

                {/* Linked To */}
                {document.property && (
                  <div>
                    <label className="text-xs text-muted-foreground">Property</label>
                    <p className="text-sm">{document.property.address_line}</p>
                  </div>
                )}
                {document.company && (
                  <div>
                    <label className="text-xs text-muted-foreground">Company</label>
                    <p className="text-sm">{document.company.legal_name}</p>
                  </div>
                )}

                <Separator />

                {/* Upload Info */}
                <div>
                  <label className="text-xs text-muted-foreground">Uploaded</label>
                  <p className="text-sm">
                    {format(new Date(document.created_at), 'dd MMM yyyy, HH:mm')}
                  </p>
                </div>

                {/* Activity */}
                {activity && activity.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <label className="text-xs text-muted-foreground mb-2 block">Recent Activity</label>
                      <div className="space-y-2">
                        {activity.slice(0, 5).map(a => (
                          <div key={a.id} className="flex items-center gap-2 text-xs">
                            {a.action === 'viewed' && <Eye className="h-3 w-3" />}
                            {a.action === 'downloaded' && <Download className="h-3 w-3" />}
                            {a.action === 'edited' && <Pencil className="h-3 w-3" />}
                            {a.action === 'uploaded' && <FileText className="h-3 w-3" />}
                            <span className="capitalize">{a.action}</span>
                            <span className="text-muted-foreground ml-auto">
                              {format(new Date(a.performed_at), 'dd MMM HH:mm')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Delete */}
                <Button
                  variant="outline"
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={onDelete}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Document
                </Button>
              </div>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
