import { useState } from 'react';
import { Bookmark, BookmarkPlus, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useSavedViews,
  useCreateSavedView,
  useDeleteSavedView,
  type SavedView,
} from '@/hooks/useSavedViews';
import { toast } from "sonner";

interface SavedViewsMenuProps {
  /** Stable identifier per list page (e.g. "properties", "compliance") */
  scope: string;
  /** Current filter state to capture when saving */
  currentFilters: Record<string, unknown>;
  /** Apply a previously-saved filter set */
  onApply: (filters: Record<string, unknown>) => void;
}

/**
 * Compact dropdown that lets users save the current filter/sort state
 * as a named "view" and re-apply or share it later.
 */
export function SavedViewsMenu({ scope, currentFilters, onApply }: SavedViewsMenuProps) {
  const { data: views = [] } = useSavedViews(scope);
  const createView = useCreateSavedView();
  const deleteView = useDeleteSavedView();

  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await createView.mutateAsync({
        scope,
        name: trimmed,
        filters: currentFilters,
        is_shared: shared,
      });
      toast.success('View saved', { description: `"${trimmed}" is ready to reuse.` });
      setSaveOpen(false);
      setName('');
      setShared(false);
    } catch (err) {
      toast.error('Could not save view', { description: err instanceof Error ? err.message : 'Unexpected error' });
    }
  };

  const handleDelete = async (e: React.MouseEvent, view: SavedView) => {
    e.stopPropagation();
    try {
      await deleteView.mutateAsync(view.id);
      toast.success('View deleted');
    } catch (err) {
      toast.error('Could not delete view', { description: err instanceof Error ? err.message : 'Unexpected error' });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Bookmark className="h-4 w-4" />
            Views
            {views.length > 0 && (
              <span className="text-xs text-muted-foreground">({views.length})</span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Saved views</DropdownMenuLabel>
          {views.length === 0 && (
            <div className="px-2 py-3 text-xs text-muted-foreground">
              No saved views yet. Save the current filter to reuse it later.
            </div>
          )}
          {views.map((view) => (
            <DropdownMenuItem
              key={view.id}
              onClick={() => onApply(view.filters_json)}
              className="flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate">{view.name}</span>
                {view.is_shared && (
                  <Users className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                )}
              </div>
              <button
                onClick={(e) => handleDelete(e, view)}
                className="text-muted-foreground hover:text-destructive p-0.5"
                aria-label={`Delete view ${view.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setSaveOpen(true)} className="gap-2">
            <BookmarkPlus className="h-4 w-4" />
            Save current view…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save current view</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="view-name">Name</Label>
              <Input
                id="view-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Overdue HMOs"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="view-shared" className="text-sm">Share with team</Label>
                <p className="text-xs text-muted-foreground">Visible to everyone in your organisation.</p>
              </div>
              <Switch id="view-shared" checked={shared} onCheckedChange={setShared} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!name.trim() || createView.isPending}>
              Save view
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
