import { useState, useRef } from 'react';
import { Camera, FileImage, Upload, Download, RefreshCw, X, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { usePropertyPhotos, useUploadPhoto, useSetCoverPhoto } from '@/hooks/usePhotos';
import { usePrimaryFloorplan, useUploadFloorplan } from '@/hooks/useFloorplans';

interface PropertyMediaHeaderProps {
  propertyId: string;
  propertyAddress: string;
}

export function PropertyMediaHeader({ propertyId, propertyAddress }: PropertyMediaHeaderProps) {
  const { toast } = useToast();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const floorplanInputRef = useRef<HTMLInputElement>(null);

  // Cover photo state
  const [showCoverLightbox, setShowCoverLightbox] = useState(false);
  const { data: photos = [] } = usePropertyPhotos(propertyId);
  const uploadPhoto = useUploadPhoto();
  const setCoverPhoto = useSetCoverPhoto();
  const coverPhoto = photos.find(p => p.is_cover) || photos[0];

  // Floorplan state
  const [showFloorplanViewer, setShowFloorplanViewer] = useState(false);
  const [showFloorplanUpload, setShowFloorplanUpload] = useState(false);
  const [floorplanVersionLabel, setFloorplanVersionLabel] = useState('Current');
  const [pdfZoom, setPdfZoom] = useState(100);
  const { data: primaryFloorplan } = usePrimaryFloorplan(propertyId);
  const uploadFloorplan = useUploadFloorplan();

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a JPEG, PNG, or WebP image',
        variant: 'destructive',
      });
      return;
    }

    try {
      const newPhoto = await uploadPhoto.mutateAsync({ file, propertyId });
      // Set as cover immediately
      await setCoverPhoto.mutateAsync({ photoId: newPhoto.id, propertyId });
      toast({
        title: 'Cover photo updated',
        description: 'Your new cover photo has been set',
      });
    } catch {
      toast({
        title: 'Upload failed',
        description: 'Failed to upload cover photo',
        variant: 'destructive',
      });
    }
  };

  const handleFloorplanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF or image file',
        variant: 'destructive',
      });
      return;
    }

    try {
      await uploadFloorplan.mutateAsync({
        propertyId,
        file,
        isPrimary: true,
        versionLabel: floorplanVersionLabel,
      });
      setShowFloorplanUpload(false);
      setFloorplanVersionLabel('Current');
    } catch (err) {
      console.error('Failed to upload floorplan:', err);
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Something went wrong', variant: 'destructive' });
    }
  };

  const handleFloorplanClick = () => {
    if (primaryFloorplan) {
      setShowFloorplanViewer(true);
    } else {
      setShowFloorplanUpload(true);
    }
  };

  const handleDownloadFloorplan = () => {
    if (primaryFloorplan) {
      const link = document.createElement('a');
      link.href = primaryFloorplan.file_url;
      link.download = primaryFloorplan.final_file_name || primaryFloorplan.original_file_name;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <TooltipProvider>
      <div className="flex items-start gap-4">
        {/* Cover Photo Thumbnail */}
        <div className="relative group shrink-0">
          <div
            className="w-32 h-24 rounded-lg overflow-hidden border border-border bg-muted cursor-pointer transition-all hover:border-primary"
            onClick={() => coverPhoto && setShowCoverLightbox(true)}
          >
            {coverPhoto ? (
              <img
                src={coverPhoto.file_url}
                alt={propertyAddress}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                <Camera className="h-6 w-6 mb-1" />
                <span className="text-xs">No photo</span>
              </div>
            )}
          </div>

          {/* Hover overlay for cover photo */}
          <div className="absolute inset-0 rounded-lg bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    coverInputRef.current?.click();
                  }}
                  disabled={uploadPhoto.isPending}
                >
                  {uploadPhoto.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-3 w-3 mr-1" />
                      {coverPhoto ? 'Change' : 'Upload'}
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {coverPhoto ? 'Change cover photo' : 'Upload cover photo'}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Floorplan badge/button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleFloorplanClick}
                className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-full border-2 border-background flex items-center justify-center transition-all ${
                  primaryFloorplan
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 border-dashed border-border'
                }`}
              >
                <FileImage className="h-4 w-4" />
                {primaryFloorplan && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-success rounded-full border border-background" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {primaryFloorplan ? 'View floorplan' : 'Upload floorplan'}
            </TooltipContent>
          </Tooltip>

          <input
            ref={coverInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleCoverUpload}
          />
        </div>

        {/* Cover Photo Lightbox */}
        {showCoverLightbox && coverPhoto && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setShowCoverLightbox(false)}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-white hover:bg-white/20"
              onClick={() => setShowCoverLightbox(false)}
            >
              <X className="h-6 w-6" />
            </Button>
            <img
              src={coverPhoto.file_url}
              alt={propertyAddress}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        {/* Floorplan Viewer Modal */}
        <Dialog open={showFloorplanViewer} onOpenChange={setShowFloorplanViewer}>
          <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Floorplan - {primaryFloorplan?.version_label || 'Current'}</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadFloorplan}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowFloorplanViewer(false);
                      setShowFloorplanUpload(true);
                    }}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Replace
                  </Button>
                </div>
              </DialogTitle>
            </DialogHeader>
            
            <div className="flex-1 overflow-auto bg-muted rounded-lg">
              {primaryFloorplan?.file_type === 'pdf' ? (
                <div className="h-full flex flex-col">
                  <div className="flex items-center gap-2 p-2 border-b border-border bg-background">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPdfZoom(z => Math.max(50, z - 25))}
                      disabled={pdfZoom <= 50}
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="text-sm min-w-[4rem] text-center">{pdfZoom}%</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPdfZoom(z => Math.min(200, z + 25))}
                      disabled={pdfZoom >= 200}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </div>
                  <iframe
                    src={primaryFloorplan.file_url}
                    className="flex-1 w-full"
                    style={{ transform: `scale(${pdfZoom / 100})`, transformOrigin: 'top left' }}
                    title="Floorplan PDF"
                  />
                </div>
              ) : primaryFloorplan ? (
                <div className="h-full flex items-center justify-center p-4">
                  <img
                    src={primaryFloorplan.file_url}
                    alt="Floorplan"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        {/* Floorplan Upload Modal */}
        <Dialog open={showFloorplanUpload} onOpenChange={setShowFloorplanUpload}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Floorplan</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="version-label">Version Label (optional)</Label>
                <Input
                  id="version-label"
                  value={floorplanVersionLabel}
                  onChange={(e) => setFloorplanVersionLabel(e.target.value)}
                  placeholder="e.g., Current, As-built, Proposed"
                />
              </div>

              <div
                className="border-2 border-dashed rounded-lg p-8 text-center transition-colors hover:border-primary cursor-pointer"
                onClick={() => floorplanInputRef.current?.click()}
              >
                {uploadFloorplan.isPending ? (
                  <>
                    <Loader2 className="h-8 w-8 mx-auto mb-2 text-primary animate-spin" />
                    <p className="text-foreground font-medium">Uploading...</p>
                  </>
                ) : (
                  <>
                    <FileImage className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-foreground font-medium mb-1">
                      Click to select floorplan
                    </p>
                    <p className="text-sm text-muted-foreground">
                      PDF or image (JPEG, PNG, WebP)
                    </p>
                  </>
                )}
              </div>

              <input
                ref={floorplanInputRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFloorplanUpload}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
