import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  useCreateEntity,
  useAddShareholding,
  useUpdateShareholding,
  type ShareholdingWithEntity,
} from '@/hooks/useOwnershipLookthrough';
import { useToast } from '@/hooks/use-toast';

interface ShareholdingEditorProps {
  parentEntityId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingShareholding?: ShareholdingWithEntity | null;
}

const ENTITY_TYPES = ['Person', 'Company', 'SPV', 'Investor', 'Other'];

export function ShareholdingEditor({
  parentEntityId,
  open,
  onOpenChange,
  editingShareholding,
}: ShareholdingEditorProps) {
  const { toast } = useToast();
  const { data: entities } = useOwnershipEntities();
  const createEntity = useCreateEntity();
  const addShareholding = useAddShareholding();
  const updateShareholding = useUpdateShareholding();

  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [shareholderPercent, setShareholderPercent] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [showNewEntityForm, setShowNewEntityForm] = useState(false);
  const [newEntityName, setNewEntityName] = useState('');
  const [newEntityType, setNewEntityType] = useState<string>('Company');

  const isEditing = !!editingShareholding;
  const isSubmitting = addShareholding.isPending || updateShareholding.isPending;

  // Filter out the parent entity from selectable options
  const availableEntities = entities?.filter(e => e.id !== parentEntityId) || [];

  useEffect(() => {
    if (open) {
      if (editingShareholding) {
        setSelectedEntityId(editingShareholding.shareholder_entity_id);
        setShareholderPercent(String(editingShareholding.shareholder_percent));
        setNotes(editingShareholding.notes || '');
      } else {
        setSelectedEntityId('');
        setShareholderPercent('');
        setNotes('');
      }
      setShowNewEntityForm(false);
      setNewEntityName('');
      setNewEntityType('Company');
    }
  }, [open, editingShareholding]);

  const handleCreateEntity = async () => {
    if (!newEntityName.trim()) {
      toast({ title: 'Error', description: 'Entity name is required', variant: 'destructive' });
      return;
    }

    try {
      const newEntity = await createEntity.mutateAsync({
        name: newEntityName.trim(),
        entity_type: newEntityType,
      });
      setSelectedEntityId(newEntity.id);
      setShowNewEntityForm(false);
      toast({ title: 'Entity created', description: `${newEntityName} has been created` });
    } catch (error) {
      console.error('Failed to create entity:', error);
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to create entity', variant: 'destructive' });
    }
  };

  const handleSubmit = async () => {
    if (!selectedEntityId) {
      toast({ title: 'Error', description: 'Please select a shareholder', variant: 'destructive' });
      return;
    }

    const percent = parseFloat(shareholderPercent);
    if (isNaN(percent) || percent < 0 || percent > 100) {
      toast({ title: 'Error', description: 'Shareholding must be between 0 and 100%', variant: 'destructive' });
      return;
    }

    try {
      if (isEditing && editingShareholding) {
        await updateShareholding.mutateAsync({
          id: editingShareholding.id,
          parentEntityId,
          shareholder_entity_id: selectedEntityId,
          shareholder_percent: percent,
          notes: notes.trim() || null,
        });
        toast({ title: 'Shareholding updated' });
      } else {
        await addShareholding.mutateAsync({
          parent_entity_id: parentEntityId,
          shareholder_entity_id: selectedEntityId,
          shareholder_percent: percent,
          notes: notes.trim() || null,
        });
        toast({ title: 'Shareholder added' });
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save shareholding:', error);
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to save shareholding', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Shareholder' : 'Add Shareholder'}
          </DialogTitle>
          <DialogDescription>
            Record a shareholder's stake in this entity — individual or corporate holder.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Entity Selection or Creation */}
          {!showNewEntityForm ? (
            <div className="space-y-2">
              <Label>Shareholder Entity</Label>
              <div className="flex gap-2">
                <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select shareholder..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEntities.map(entity => (
                      <SelectItem key={entity.id} value={entity.id}>
                        {entity.name} ({entity.entity_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button aria-label="Add"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowNewEntityForm(true)}
                  title="Create new entity"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <h4 className="font-medium">Create New Entity</h4>
              <div className="space-y-2">
                <Label>Entity Name</Label>
                <Input
                  value={newEntityName}
                  onChange={(e) => setNewEntityName(e.target.value)}
                  placeholder="e.g., Hydrogen Capital Ltd"
                />
              </div>
              <div className="space-y-2">
                <Label>Entity Type</Label>
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
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowNewEntityForm(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateEntity} disabled={createEntity.isPending}>
                  {createEntity.isPending ? 'Creating...' : 'Create Entity'}
                </Button>
              </div>
            </div>
          )}

          {/* Shareholding Percentage */}
          <div className="space-y-2">
            <Label>Shareholding Percentage</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={shareholderPercent}
                onChange={(e) => setShareholderPercent(e.target.value)}
                placeholder="e.g., 33.3"
                className="w-32"
              />
              <span className="text-muted-foreground">%</span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEditing ? 'Update' : 'Add Shareholder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}