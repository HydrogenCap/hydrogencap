import React, { useState, useCallback } from 'react';
import {
  Camera,
  Upload,
  Image,
  FileText,
  Receipt,
  Trash2,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useJobEvidence, useUploadEvidence, useDeleteEvidence, type JobEvidence } from '@/hooks/useContractorUpgrade';
import { cn } from '@/lib/utils';

interface JobEvidenceGalleryProps {
  jobId: string;
}

const EVIDENCE_TYPE_CONFIG: Record<
  JobEvidence['evidence_type'],
  { label: string; icon: React.ElementType; color: string }
> = {
  before_photo: { label: 'Before', icon: Camera, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  during_photo: { label: 'During', icon: Camera, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  after_photo: { label: 'After', icon: Camera, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  receipt: { label: 'Receipt', icon: Receipt, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  invoice: { label: 'Invoice', icon: FileText, color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
  certificate: { label: 'Certificate', icon: FileText, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  other: { label: 'Other', icon: FileText, color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
};

const PHOTO_TYPES: JobEvidence['evidence_type'][] = ['before_photo', 'during_photo', 'after_photo'];
const DOCUMENT_TYPES: JobEvidence['evidence_type'][] = ['receipt', 'invoice', 'certificate', 'other'];

export function JobEvidenceGallery({ jobId }: JobEvidenceGalleryProps) {
  const { data: evidence = [], isLoading } = useJobEvidence(jobId);
  const deleteEvidence = useDeleteEvidence();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const photos = evidence.filter((e) => PHOTO_TYPES.includes(e.evidence_type));
  const documents = evidence.filter((e) => DOCUMENT_TYPES.includes(e.evidence_type));

  const groupedPhotos = {
    before_photo: photos.filter((p) => p.evidence_type === 'before_photo'),
    during_photo: photos.filter((p) => p.evidence_type === 'during_photo'),
    after_photo: photos.filter((p) => p.evidence_type === 'after_photo'),
  };

  const openLightbox = useCallback((index: number) => setLightboxIndex(index), []);
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          Evidence Trail ({evidence.length})
        </h3>
        <Button variant="outline" size="sm" onClick={() => setShowUpload(true)}>
          <Upload className="h-4 w-4 mr-1" />
          Upload
        </Button>
      </div>

      {evidence.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Camera className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground mb-3">
              No evidence uploaded yet. Add before/after photos, receipts, or certificates.
            </p>
            <Button variant="outline" size="sm" onClick={() => setShowUpload(true)}>
              <Upload className="h-4 w-4 mr-1" />
              Upload Evidence
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Photo Sections */}
          {(Object.entries(groupedPhotos) as [JobEvidence['evidence_type'], JobEvidence[]][]).map(
            ([type, items]) => {
              const config = EVIDENCE_TYPE_CONFIG[type];
              if (items.length === 0) return null;

              return (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={cn('text-xs', config.color)}>
                      <config.icon className="h-3 w-3 mr-1" />
                      {config.label} Photos
                    </Badge>
                    <span className="text-xs text-muted-foreground">({items.length})</span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {items.map((item) => {
                      const globalIndex = photos.indexOf(item);
                      return (
                        <div
                          key={item.id}
                          className="group relative aspect-square rounded-md overflow-hidden bg-muted cursor-pointer"
                          onClick={() => openLightbox(globalIndex)}
                        >
                          <img
                            src={item.file_url}
                            alt={item.description || config.label}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                          <button
                            className="absolute top-1 right-1 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteEvidence.mutate({ id: item.id, jobId });
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                          {item.description && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                              <p className="text-[10px] text-white truncate">{item.description}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }
          )}

          {/* Document Section */}
          {documents.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Receipts & Documents</h4>
              <div className="space-y-2">
                {documents.map((doc) => {
                  const config = EVIDENCE_TYPE_CONFIG[doc.evidence_type];
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 p-2 rounded-md border hover:bg-muted/50 transition-colors"
                    >
                      <div className={cn('h-8 w-8 rounded flex items-center justify-center', config.color)}>
                        <config.icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {doc.description || config.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(doc.taken_at).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => window.open(doc.file_url, '_blank')}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive"
                          onClick={() => deleteEvidence.mutate({ id: doc.id, jobId })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <Dialog open onOpenChange={closeLightbox}>
          <DialogContent className="max-w-3xl p-0 overflow-hidden">
            <div className="relative">
              <img
                src={photos[lightboxIndex].file_url}
                alt={photos[lightboxIndex].description || 'Evidence photo'}
                className="w-full max-h-[80vh] object-contain bg-black"
              />
              <button
                className="absolute top-2 right-2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
                onClick={closeLightbox}
              >
                <X className="h-4 w-4" />
              </button>
              {lightboxIndex > 0 && (
                <button
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
                  onClick={() => setLightboxIndex(lightboxIndex - 1)}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              {lightboxIndex < photos.length - 1 && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
                  onClick={() => setLightboxIndex(lightboxIndex + 1)}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2">
                <Badge className={cn('text-xs', EVIDENCE_TYPE_CONFIG[photos[lightboxIndex].evidence_type].color)}>
                  {EVIDENCE_TYPE_CONFIG[photos[lightboxIndex].evidence_type].label}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(photos[lightboxIndex].taken_at).toLocaleString('en-GB')}
                </span>
              </div>
              {photos[lightboxIndex].description && (
                <p className="text-sm mt-1">{photos[lightboxIndex].description}</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      <UploadEvidenceDialog jobId={jobId} open={showUpload} onOpenChange={setShowUpload} />
    </div>
  );
}

// ── Upload Dialog ──────────────────────────────────────────────────────────────

function UploadEvidenceDialog({
  jobId,
  open,
  onOpenChange,
}: {
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const uploadEvidence = useUploadEvidence();
  const [evidenceType, setEvidenceType] = useState<JobEvidence['evidence_type']>('before_photo');
  const [fileUrl, setFileUrl] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async () => {
    if (!fileUrl) return;

    await uploadEvidence.mutateAsync({
      jobId,
      evidenceType,
      fileUrl,
      description: description || undefined,
    });

    setFileUrl('');
    setDescription('');
    setEvidenceType('before_photo');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Evidence</DialogTitle>
          <DialogDescription>Add photos, receipts, or certificates for this job.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Type *</Label>
            <Select
              value={evidenceType}
              onValueChange={(v) => setEvidenceType(v as JobEvidence['evidence_type'])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(EVIDENCE_TYPE_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>File URL *</Label>
            <div className="flex gap-2">
              <Input
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="https://storage.example.com/photo.jpg"
                className="flex-1"
              />
              <Button variant="outline" size="icon" className="shrink-0" disabled>
                <Camera className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter the URL of the uploaded file or use the storage upload.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this evidence shows..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!fileUrl || uploadEvidence.isPending}>
            {uploadEvidence.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</>
            ) : (
              <><Upload className="h-4 w-4 mr-1" />Upload</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
