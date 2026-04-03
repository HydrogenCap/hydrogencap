import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X, Columns, Image as ImageIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useCapexPhotos, useCreateCapexPhoto, useDeleteCapexPhoto, useCapexPhases, type CapexPhoto } from '@/hooks/useCapexUpgrade';

const CATEGORIES = ['before', 'during', 'after', 'issue'] as const;
const CATEGORY_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  before: { label: 'Before', variant: 'secondary' },
  during: { label: 'During', variant: 'default' },
  after: { label: 'After', variant: 'outline' },
  issue: { label: 'Issue', variant: 'destructive' },
};

export default function PhotoJournal({ projectId }: { projectId: string }) {
  const { data: photos = [], isLoading } = useCapexPhotos(projectId);
  const { data: phases = [] } = useCapexPhases(projectId);
  const deletePhoto = useDeleteCapexPhoto();
  const [showAdd, setShowAdd] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [lightboxPhoto, setLightboxPhoto] = useState<CapexPhoto | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [comparePhotos, setComparePhotos] = useState<[CapexPhoto | null, CapexPhoto | null]>([null, null]);

  const phaseMap = useMemo(() => new Map(phases.map(p => [p.id, p.phase_name])), [phases]);

  const filtered = useMemo(() => {
    if (filterCategory === 'all') return photos;
    return photos.filter(p => p.category === filterCategory);
  }, [photos, filterCategory]);

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, CapexPhoto[]>();
    for (const photo of filtered) {
      const key = format(parseISO(photo.taken_at), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(photo);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  const handleCompareSelect = (photo: CapexPhoto) => {
    if (comparePhotos[0] === null) {
      setComparePhotos([photo, null]);
    } else if (comparePhotos[1] === null) {
      setComparePhotos([comparePhotos[0], photo]);
    } else {
      setComparePhotos([photo, null]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Photos</SelectItem>
              {CATEGORIES.map(c => (
                <SelectItem key={c} value={c}>{CATEGORY_LABELS[c].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={compareMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setCompareMode(!compareMode);
              setComparePhotos([null, null]);
            }}
          >
            <Columns className="h-3 w-3 mr-1" /> Compare
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-3 w-3 mr-1" /> Add Photo
        </Button>
      </div>

      {/* Compare view */}
      {compareMode && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Side-by-Side Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {[0, 1].map(i => (
                <div key={i} className="border rounded-lg overflow-hidden aspect-video bg-muted flex items-center justify-center">
                  {comparePhotos[i] ? (
                    <div className="relative w-full h-full">
                      <img src={comparePhotos[i]!.photo_url} alt="" className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white p-2 text-xs">
                        <p>{comparePhotos[i]!.description || 'No description'}</p>
                        <p className="text-white/70">{format(parseISO(comparePhotos[i]!.taken_at), 'dd MMM yyyy')}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {compareMode ? 'Click a photo below to select' : 'No photo selected'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Photo grid */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No photos yet. Upload progress photos to track the project visually.</p>
          </CardContent>
        </Card>
      ) : (
        grouped.map(([date, datePhotos]) => (
          <div key={date}>
            <h3 className="text-sm font-medium mb-2">{format(parseISO(date), 'EEEE, dd MMMM yyyy')}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {datePhotos.map(photo => {
                const catInfo = CATEGORY_LABELS[photo.category] || CATEGORY_LABELS.during;
                const isSelected = comparePhotos[0]?.id === photo.id || comparePhotos[1]?.id === photo.id;
                return (
                  <div
                    key={photo.id}
                    className={`relative group border rounded-lg overflow-hidden cursor-pointer ${isSelected ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => compareMode ? handleCompareSelect(photo) : setLightboxPhoto(photo)}
                  >
                    <div className="aspect-video bg-muted">
                      <img src={photo.photo_url} alt={photo.description || ''} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-2">
                      <div className="flex items-center justify-between">
                        <Badge variant={catInfo.variant} className="text-xs">{catInfo.label}</Badge>
                        {photo.phase_id && (
                          <span className="text-xs text-muted-foreground">{phaseMap.get(photo.phase_id)}</span>
                        )}
                      </div>
                      {photo.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{photo.description}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 bg-black/40 text-white hover:bg-black/60"
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePhoto.mutate(photo.id);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Lightbox */}
      {lightboxPhoto && (
        <Dialog open={!!lightboxPhoto} onOpenChange={() => setLightboxPhoto(null)}>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{lightboxPhoto.description || 'Photo'}</DialogTitle>
              <DialogDescription>
                {format(parseISO(lightboxPhoto.taken_at), 'dd MMMM yyyy')}
                {lightboxPhoto.phase_id && ` — ${phaseMap.get(lightboxPhoto.phase_id)}`}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg overflow-hidden">
              <img src={lightboxPhoto.photo_url} alt={lightboxPhoto.description || ''} className="w-full" />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={CATEGORY_LABELS[lightboxPhoto.category]?.variant || 'default'}>
                {CATEGORY_LABELS[lightboxPhoto.category]?.label || lightboxPhoto.category}
              </Badge>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <AddPhotoDialog open={showAdd} onOpenChange={setShowAdd} projectId={projectId} phases={phases} />
    </div>
  );
}

function AddPhotoDialog({ open, onOpenChange, projectId, phases }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  phases: Array<{ id: string; phase_name: string }>;
}) {
  const create = useCreateCapexPhoto();
  const [photoUrl, setPhotoUrl] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('during');
  const [phaseId, setPhaseId] = useState('');
  const [takenAt, setTakenAt] = useState(new Date().toISOString().split('T')[0]);

  const handleCreate = () => {
    if (!photoUrl) return;
    create.mutate({
      project_id: projectId,
      phase_id: phaseId || null,
      photo_url: photoUrl,
      description: description || null,
      taken_at: new Date(takenAt).toISOString(),
      category: category as 'before' | 'during' | 'after' | 'issue',
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setPhotoUrl('');
        setDescription('');
        setCategory('during');
        setPhaseId('');
        setTakenAt(new Date().toISOString().split('T')[0]);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Photo</DialogTitle>
          <DialogDescription>Add a progress photo to the journal</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Photo URL</Label><Input value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} placeholder="https://..." /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Date Taken</Label><Input type="date" value={takenAt} onChange={e => setTakenAt(e.target.value)} /></div>
          </div>
          {phases.length > 0 && (
            <div>
              <Label>Phase</Label>
              <Select value={phaseId} onValueChange={setPhaseId}>
                <SelectTrigger><SelectValue placeholder="Select phase" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {phases.map(p => <SelectItem key={p.id} value={p.id}>{p.phase_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!photoUrl || create.isPending}>
            {create.isPending ? 'Adding...' : 'Add Photo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
