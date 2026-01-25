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
  useCreateEntity,
  useAddLegalOwnership,
  useUpdateLegalOwnership,
  type LegalOwnershipWithEntity,
} from '@/hooks/useOwnershipLookthrough';
import { useToast } from '@/hooks/use-toast';

interface LegalOwnershipEditorProps {
  propertyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingOwnership?: LegalOwnershipWithEntity | null;
}

const ENTITY_TYPES = ['Person', 'Company', 'SPV', 'Investor', 'Other'];

export function LegalOwnershipEditor({
  propertyId,
  open,
  onOpenChange,
  editingOwnership,
}: LegalOwnershipEditorProps) {
  const { toast } = useToast();
  const { data: entities } = useOwnershipEntities();
  const createEntity = useCreateEntity();
  const addLegalOwnership = useAddLegalOwnership();
  const updateLegalOwnership = useUpdateLegalOwnership();

  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [ownerPercent, setOwnerPercent] = useState<string>('100');
  const [notes, setNotes] = useState<string>('');
  const [showNewEntityForm, setShowNewEntityForm] = useState(false);
  const [newEntityName, setNewEntityName] = useState('');
  const [newEntityType, setNewEntityType] = useState<string>('SPV');

  const isEditing = !!editingOwnership;
  const isSubmitting = addLegalOwnership.isPending || updateLegalOwnership.isPending;

  useEffect(() => {
    if (open) {
      if (editingOwnership) {
        setSelectedEntityId(editingOwnership.owner_entity_id);
        setOwnerPercent(String(editingOwnership.owner_percent));
        setNotes(editingOwnership.notes || '');
      } else {
        setSelectedEntityId('');
        setOwnerPercent('100');
        setNotes('');
      }
      setShowNewEntityForm(false);
      setNewEntityName('');
      setNewEntityType('SPV');
    }
  }, [open, editingOwnership]);

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
    } catch {
      toast({ title: 'Error', description: 'Failed to create entity', variant: 'destructive' });
    }
  };

  const handleSubmit = async () => {
    if (!selectedEntityId) {
      toast({ title: 'Error', description: 'Please select an entity', variant: 'destructive' });
      return;
    }

    const percent = parseFloat(ownerPercent);
    if (isNaN(percent) || percent < 0 || percent > 100) {
      toast({ title: 'Error', description: 'Ownership must be between 0 and 100%', variant: 'destructive' });
      return;
    }

    try {
      if (isEditing && editingOwnership) {
        await updateLegalOwnership.mutateAsync({
          id: editingOwnership.id,
          propertyId,
          owner_entity_id: selectedEntityId,
          owner_percent: percent,
          notes: notes.trim() || null,
        });
        toast({ title: 'Ownership updated' });
      } else {
        await addLegalOwnership.mutateAsync({
          property_id: propertyId,
          owner_entity_id: selectedEntityId,
          owner_percent: percent,
          notes: notes.trim() || null,
        });
        toast({ title: 'Legal owner added' });
      }
      onOpenChange(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to save ownership', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Legal Owner' : 'Add Legal Owner'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Entity Selection or Creation */}
          {!showNewEntityForm ? (
            <div className="space-y-2">
              <Label>Legal Owner Entity</Label>
              <div className="flex gap-2">
                <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select entity..." />
                  </SelectTrigger>
                  <SelectContent>
                    {entities?.map(entity => (
                      <SelectItem key={entity.id} value={entity.id}>
                        {entity.name} ({entity.entity_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
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
                  placeholder="e.g., Yashil Properties Ltd"
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

          {/* Ownership Percentage */}
          <div className="space-y-2">
            <Label>Ownership Percentage</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={ownerPercent}
                onChange={(e) => setOwnerPercent(e.target.value)}
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
            {isSubmitting ? 'Saving...' : isEditing ? 'Update' : 'Add Owner'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}