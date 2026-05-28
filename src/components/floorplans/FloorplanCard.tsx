import { useState, useRef } from 'react';
import { FileText, Upload, Eye, Download, Trash2, Star, EllipsisVertical, Image as ImageIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  usePrimaryFloorplan,
  useFloorplans,
  useUploadFloorplan,
  useDeleteFloorplan,
  useSetPrimaryFloorplan,
  type Floorplan,
} from '@/hooks/useFloorplans';

interface FloorplanCardProps {
  propertyId: string;
  showAllFloorplans?: boolean;
}

export function FloorplanCard({ propertyId, showAllFloorplans = false }: FloorplanCardProps) {
  const { data: primaryFloorplan, isLoading: primaryLoading } = usePrimaryFloorplan(propertyId);
  const { data: allFloorplans, isLoading: allLoading } = useFloorplans(propertyId);
  const uploadFloorplan = useUploadFloorplan();
  const deleteFloorplan = useDeleteFloorplan();
  const setPrimary = useSetPrimaryFloorplan();

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedFloorplan, setSelectedFloorplan] = useState<Floorplan | null>(null);
  const [isPrimary, setIsPrimary] = useState(true);
  const [versionLabel, setVersionLabel] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLoading = primaryLoading || allLoading;
  const floorplans = showAllFloorplans ? allFloorplans : (primaryFloorplan ? [primaryFloorplan] : []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        alert('Please upload a PDF or image file (JPEG, PNG, WebP, GIF)');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    await uploadFloorplan.mutateAsync({
      propertyId,
      file: selectedFile,
      isPrimary,
      versionLabel: versionLabel || undefined,
    });

    setUploadDialogOpen(false);
    setSelectedFile(null);
    setVersionLabel('');
    setIsPrimary(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async () => {
    if (!selectedFloorplan) return;
    await deleteFloorplan.mutateAsync({
      id: selectedFloorplan.id,
      propertyId,
      fileUrl: selectedFloorplan.file_url,
    });
    setDeleteDialogOpen(false);
    setSelectedFloorplan(null);
  };

  const handleSetPrimary = async (floorplan: Floorplan) => {
    await setPrimary.mutateAsync({ id: floorplan.id, propertyId });
  };

  const handleDownload = (floorplan: Floorplan) => {
    const link = document.createElement('a');
    link.href = floorplan.file_url;
    link.download = floorplan.original_file_name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Floorplan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Floorplan
              {allFloorplans && allFloorplans.length > 1 && (
                <Badge variant="secondary" className="ml-1">
                  {allFloorplans.length}
                </Badge>
              )}
            </CardTitle>
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-1" />
                  Upload
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload Floorplan</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label htmlFor="floorplan-file">File (PDF or Image)</Label>
                    <Input
                      ref={fileInputRef}
                      id="floorplan-file"
                      type="file"
                      accept=".pdf,image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleFileSelect}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="version-label">Version Label (optional)</Label>
                    <Input
                      id="version-label"
                      placeholder="e.g., Current, Proposed, As-built"
                      value={versionLabel}
                      onChange={(e) => setVersionLabel(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is-primary"
                      checked={isPrimary}
                      onCheckedChange={(checked) => setIsPrimary(checked === true)}
                    />
                    <Label htmlFor="is-primary" className="text-sm font-normal">
                      Set as primary floorplan
                    </Label>
                  </div>
                  <Button
                    onClick={handleUpload}
                    disabled={!selectedFile || uploadFloorplan.isPending}
                    className="w-full"
                  >
                    {uploadFloorplan.isPending ? 'Uploading...' : 'Upload Floorplan'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {!floorplans || floorplans.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No floorplan uploaded</p>
              <Button
                variant="link"
                size="sm"
                onClick={() => setUploadDialogOpen(true)}
                className="mt-1"
              >
                Upload floorplan
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {floorplans.map((floorplan) => (
                <FloorplanItem
                  key={floorplan.id}
                  floorplan={floorplan}
                  onView={() => {
                    setSelectedFloorplan(floorplan);
                    setViewDialogOpen(true);
                  }}
                  onDownload={() => handleDownload(floorplan)}
                  onDelete={() => {
                    setSelectedFloorplan(floorplan);
                    setDeleteDialogOpen(true);
                  }}
                  onSetPrimary={() => handleSetPrimary(floorplan)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Floorplan Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedFloorplan?.original_file_name}
              {selectedFloorplan?.is_primary && (
                <Badge variant="default" className="ml-2">Primary</Badge>
              )}
              {selectedFloorplan?.version_label && (
                <Badge variant="secondary">{selectedFloorplan.version_label}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[70vh]">
            {selectedFloorplan?.file_type === 'image' ? (
              <img
                src={selectedFloorplan.file_url}
                alt="Floorplan"
                className="w-full h-auto"
              />
            ) : (
              <iframe
                src={selectedFloorplan?.file_url}
                className="w-full h-[70vh]"
                title="Floorplan PDF"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Floorplan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedFloorplan?.original_file_name}"? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface FloorplanItemProps {
  floorplan: Floorplan;
  onView: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onSetPrimary: () => void;
}

function FloorplanItem({ floorplan, onView, onDownload, onDelete, onSetPrimary }: FloorplanItemProps) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
      {/* Thumbnail */}
      <div className="flex-shrink-0 w-16 h-16 rounded overflow-hidden bg-muted flex items-center justify-center">
        {floorplan.file_type === 'image' ? (
          <img
            src={floorplan.file_url}
            alt="Floorplan thumbnail"
            className="w-full h-full object-cover"
          />
        ) : (
          <FileText className="h-8 w-8 text-muted-foreground" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">
            {floorplan.version_label || floorplan.original_file_name}
          </span>
          {floorplan.is_primary && (
            <Star className="h-3 w-3 text-warning fill-warning flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {floorplan.file_type === 'pdf' ? (
            <FileText className="h-3 w-3" />
          ) : (
            <ImageIcon className="h-3 w-3" />
          )}
          <span className="truncate">{floorplan.original_file_name}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button aria-label="View floorplan" variant="ghost" size="icon" onClick={onView} title="View">
          <Eye className="h-4 w-4" />
        </Button>
        <Button aria-label="Download floorplan" variant="ghost" size="icon" onClick={onDownload} title="Download">
          <Download className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label="More options" variant="ghost" size="icon">
              <EllipsisVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!floorplan.is_primary && (
              <DropdownMenuItem onClick={onSetPrimary}>
                <Star className="h-4 w-4 mr-2" />
                Set as Primary
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
