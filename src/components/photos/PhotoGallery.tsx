import { useState, useCallback } from 'react';
import { Upload, Trash2, Star, Loader2, Image as ImageIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  usePropertyPhotos,
  useUploadPhoto,
  useSetCoverPhoto,
  useDeletePhoto,
  type Photo,
} from '@/hooks/usePhotos';

interface PhotoGalleryProps {
  propertyId: string;
}

export function PhotoGallery({ propertyId }: PhotoGalleryProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null);
  const { toast } = useToast();

  const { data: photos = [], isLoading } = usePropertyPhotos(propertyId);
  const uploadPhoto = useUploadPhoto();
  const setCoverPhoto = useSetCoverPhoto();
  const deletePhoto = useDeletePhoto();

  const handleFiles = useCallback(async (files: FileList) => {
    const validFiles = Array.from(files).filter(file => {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      return validTypes.includes(file.type);
    });

    if (validFiles.length === 0) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload image files (JPEG, PNG, WebP, GIF)',
        variant: 'destructive',
      });
      return;
    }

    for (const file of validFiles) {
      try {
        await uploadPhoto.mutateAsync({ file, propertyId });
      } catch (err) {
        toast({
          title: 'Upload failed',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        });
      }
    }

    if (validFiles.length > 0) {
      toast({
        title: 'Upload complete',
        description: `${validFiles.length} photo(s) uploaded successfully`,
      });
    }
  }, [propertyId, uploadPhoto, toast]);

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

  const handleSetCover = async (photo: Photo) => {
    try {
      await setCoverPhoto.mutateAsync({ photoId: photo.id, propertyId });
      toast({
        title: 'Cover photo updated',
        description: 'This photo is now the cover image',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to set cover photo',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!photoToDelete) return;

    try {
      await deletePhoto.mutateAsync({
        photoId: photoToDelete.id,
        propertyId,
        fileUrl: photoToDelete.file_url,
      });
      toast({
        title: 'Photo deleted',
        description: 'The photo has been removed',
      });
      setPhotoToDelete(null);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to delete photo',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-8 text-center">
          <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Loading photos...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Property Photos
          {photos.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {photos.length} photo{photos.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload Zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-muted-foreground/50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {uploadPhoto.isPending ? (
            <>
              <Loader2 className="h-8 w-8 mx-auto mb-2 text-primary animate-spin" />
              <p className="text-foreground font-medium">Uploading...</p>
            </>
          ) : (
            <>
              <Upload className={`h-8 w-8 mx-auto mb-2 ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`} />
              <p className="text-foreground font-medium mb-1">
                Drop photos here to upload
              </p>
              <p className="text-sm text-muted-foreground mb-3">
                JPEG, PNG, WebP, or GIF
              </p>
              <label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  className="hidden"
                  onChange={handleFileInput}
                />
                <Button asChild variant="outline" size="sm">
                  <span className="cursor-pointer">Browse Files</span>
                </Button>
              </label>
            </>
          )}
        </div>

        {/* Photo Grid */}
        {photos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative group aspect-[4/3] rounded-lg overflow-hidden border border-border bg-muted cursor-pointer"
                onClick={() => setSelectedPhoto(photo)}
              >
                <img
                  src={photo.file_url}
                  alt="Property photo"
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
                {photo.is_cover && (
                  <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground">
                    <Star className="h-3 w-3 mr-1 fill-current" />
                    Cover
                  </Badge>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {!photo.is_cover && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetCover(photo);
                      }}
                      disabled={setCoverPhoto.isPending}
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPhotoToDelete(photo);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No photos uploaded yet</p>
            <p className="text-sm">Upload photos to showcase this property</p>
          </div>
        )}

        {/* Lightbox */}
        {selectedPhoto && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setSelectedPhoto(null)}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-white hover:bg-white/20"
              onClick={() => setSelectedPhoto(null)}
            >
              <X className="h-6 w-6" />
            </Button>
            <img
              src={selectedPhoto.file_url}
              alt="Property photo"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        {/* Delete Confirmation */}
        <AlertDialog open={!!photoToDelete} onOpenChange={() => setPhotoToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Photo</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this photo? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deletePhoto.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Delete'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
