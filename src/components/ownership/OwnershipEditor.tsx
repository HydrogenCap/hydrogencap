import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useOwnershipEntities,
  useCreateOwnershipEntity,
  useAddPropertyOwnership,
  useUpdatePropertyOwnership,
  type PropertyOwnershipWithEntity,
} from '@/hooks/useOwnership';
import { useToast } from '@/hooks/use-toast';

interface OwnershipEditorProps {
  propertyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingOwnership?: PropertyOwnershipWithEntity | null;
  defaultLevel?: 'Property' | 'SPV_Shareholding';
}

const ENTITY_TYPES = ['Person', 'Company', 'SPV', 'Investor'] as const;

export function OwnershipEditor({
  propertyId,
  open,
  onOpenChange,
  editingOwnership,
  defaultLevel = 'Property',
}: OwnershipEditorProps) {
  const { data: entities } = useOwnershipEntities();
  const createEntity = useCreateOwnershipEntity();
  const addOwnership = useAddPropertyOwnership();
  const updateOwnership = useUpdatePropertyOwnership();
  const { toast } = useToast();

  const [showNewEntity, setShowNewEntity] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [percent, setPercent] = useState('');
  const [level, setLevel] = useState<'Property' | 'SPV_Shareholding'>(defaultLevel);
  const [notes, setNotes] = useState('');

  // New entity form
  const [newEntityName, setNewEntityName] = useState('');
  const [newEntityType, setNewEntityType] = useState<string>('Company');
  const [newEntityNotes, setNewEntityNotes] = useState('');

  // Reset form when opening/closing
  useEffect(() => {
    if (open) {
      if (editingOwnership) {
        setSelectedEntityId(editingOwnership.ownership_entity_id);
        setPercent(String(editingOwnership.ownership_percent));
        setLevel(editingOwnership.ownership_level as 'Property' | 'SPV_Shareholding');
        setNotes(editingOwnership.notes || '');
      } else {
        setSelectedEntityId('');
        setPercent('');
        setLevel(defaultLevel);
        setNotes('');
      }
      setShowNewEntity(false);
      setNewEntityName('');
      setNewEntityType('Company');
      setNewEntityNotes('');
    }
  }, [open, editingOwnership, defaultLevel]);

  const handleCreateEntity = async () => {
    if (!newEntityName.trim()) return;

    try {
      const entity = await createEntity.mutateAsync({
        name: newEntityName.trim(),
        entity_type: newEntityType,
        notes: newEntityNotes.trim() || null,
      });
      setSelectedEntityId(entity.id);
      setShowNewEntity(false);
      toast({ title: 'Entity created', description: `${entity.name} added to your entities.` });
    } catch {
      toast({ title: 'Error', description: 'Failed to create entity', variant: 'destructive' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const percentNum = parseFloat(percent);
    if (!selectedEntityId || isNaN(percentNum) || percentNum < 0 || percentNum > 100) {
      toast({ title: 'Invalid input', description: 'Please select an entity and enter a valid percentage', variant: 'destructive' });
      return;
    }

    try {
      if (editingOwnership) {
        await updateOwnership.mutateAsync({
          id: editingOwnership.id,
          ownership_entity_id: selectedEntityId,
          ownership_percent: percentNum,
          ownership_level: level,
          notes: notes.trim() || null,
        });
        toast({ title: 'Ownership updated' });
      } else {
        await addOwnership.mutateAsync({
          property_id: propertyId,
          ownership_entity_id: selectedEntityId,
          ownership_percent: percentNum,
          ownership_level: level,
          notes: notes.trim() || null,
        });
        toast({ title: 'Ownership added' });
      }
      onOpenChange(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to save ownership', variant: 'destructive' });
    }
  };

  const isSubmitting = addOwnership.isPending || updateOwnership.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingOwnership ? 'Edit Ownership' : 'Add Ownership'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Entity Selection or Creation */}
          {showNewEntity ? (
            <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">New Entity</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewEntity(false)}>
                  Cancel
                </Button>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="entityName">Name</Label>
                <Input
                  id="entityName"
                  placeholder="e.g. Hydrogen Capital Ltd"
                  value={newEntityName}
                  onChange={e => setNewEntityName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="entityType">Type</Label>
                <Select value={newEntityType} onValueChange={setNewEntityType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="entityNotes">Notes (optional)</Label>
                <Input
                  id="entityNotes"
                  placeholder="e.g. Companies House #12345678"
                  value={newEntityNotes}
                  onChange={e => setNewEntityNotes(e.target.value)}
                />
              </div>

              <Button
                type="button"
                onClick={handleCreateEntity}
                disabled={!newEntityName.trim() || createEntity.isPending}
                className="w-full"
              >
                {createEntity.isPending ? 'Creating...' : 'Create Entity'}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="entity">Entity</Label>
              <div className="flex gap-2">
                <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select an entity..." />
                  </SelectTrigger>
                  <SelectContent>
                    {entities?.map(entity => (
                      <SelectItem key={entity.id} value={entity.id}>
                        <span className="flex items-center gap-2">
                          <span>{entity.name}</span>
                          <span className="text-xs text-muted-foreground">({entity.entity_type})</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" onClick={() => setShowNewEntity(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Ownership Level */}
          <div className="space-y-2">
            <Label htmlFor="level">Ownership Level</Label>
            <Select value={level} onValueChange={(v) => setLevel(v as 'Property' | 'SPV_Shareholding')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Property">Property Ownership</SelectItem>
                <SelectItem value="SPV_Shareholding">SPV Shareholding</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Percentage */}
          <div className="space-y-2">
            <Label htmlFor="percent">Ownership Percentage</Label>
            <div className="relative">
              <Input
                id="percent"
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="e.g. 34"
                value={percent}
                onChange={e => setPercent(e.target.value)}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Additional details about this ownership stake..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || showNewEntity}>
              {isSubmitting ? 'Saving...' : editingOwnership ? 'Update' : 'Add Ownership'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
