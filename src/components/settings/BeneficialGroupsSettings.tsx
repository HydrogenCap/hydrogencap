import React, { useState } from 'react';
import { Users, Plus, Trash2, Edit2, Check, X, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useBeneficialGroups,
  useCreateBeneficialGroup,
  useDeleteBeneficialGroup,
  useAddEntityMapping,
  useRemoveEntityMapping,
  type BeneficialGroupWithMappings,
} from '@/hooks/useBeneficialGroups';
import { useOwnershipEntities } from '@/hooks/useOwnershipLookthrough';
import { useToast } from '@/hooks/use-toast';

export function BeneficialGroupsSettings() {
  const { toast } = useToast();
  const { data: groups, isLoading } = useBeneficialGroups();
  const { data: entities } = useOwnershipEntities();
  const createGroup = useCreateBeneficialGroup();
  const deleteGroup = useDeleteBeneficialGroup();
  const addMapping = useAddEntityMapping();
  const removeMapping = useRemoveEntityMapping();

  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [addEntityDialogOpen, setAddEntityDialogOpen] = useState(false);
  const [selectedGroupForAdd, setSelectedGroupForAdd] = useState<string>('');
  const [selectedEntityForAdd, setSelectedEntityForAdd] = useState<string>('');

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    
    try {
      await createGroup.mutateAsync({ name: newGroupName.trim() });
      setNewGroupName('');
      toast({ title: 'Beneficial group created' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteGroup = async (id: string) => {
    try {
      await deleteGroup.mutateAsync(id);
      toast({ title: 'Beneficial group deleted' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleAddEntityToGroup = async () => {
    if (!selectedGroupForAdd || !selectedEntityForAdd) return;

    try {
      await addMapping.mutateAsync({
        entity_id: selectedEntityForAdd,
        beneficial_group_id: selectedGroupForAdd,
      });
      setAddEntityDialogOpen(false);
      setSelectedEntityForAdd('');
      toast({ title: 'Entity added to group' });
    } catch (error: any) {
      toast({ 
        title: 'Error', 
        description: error.message?.includes('duplicate') 
          ? 'Entity is already in this group' 
          : error.message, 
        variant: 'destructive' 
      });
    }
  };

  const handleRemoveEntityFromGroup = async (mappingId: string) => {
    try {
      await removeMapping.mutateAsync(mappingId);
      toast({ title: 'Entity removed from group' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Get entities that are already in any group
  const assignedEntityIds = new Set(
    groups?.flatMap(g => g.entity_beneficial_mapping?.map(m => m.ownership_entities?.id) || []) || []
  );

  // Get unassigned entities
  const unassignedEntities = entities?.filter(e => !assignedEntityIds.has(e.id)) || [];

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Beneficial Groups
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Beneficial Groups
        </CardTitle>
        <CardDescription>
          Manage entity groupings for attribution calculations. Entities in the same group 
          are treated as belonging to the same beneficial owner for reporting purposes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Create New Group */}
        <div className="flex gap-2">
          <Input
            placeholder="New group name..."
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
            className="flex-1"
          />
          <Button onClick={handleCreateGroup} disabled={!newGroupName.trim() || createGroup.isPending}>
            {createGroup.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Create Group
          </Button>
        </div>

        {/* Existing Groups */}
        {groups && groups.length > 0 ? (
          <div className="space-y-4">
            {groups.map((group: BeneficialGroupWithMappings) => (
              <div key={group.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <span className="font-medium text-lg">{group.name}</span>
                    {group.entity_beneficial_mapping?.length === 0 ? null : (
                      <Badge variant="secondary">
                        {group.entity_beneficial_mapping?.length || 0} entities
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Dialog open={addEntityDialogOpen && selectedGroupForAdd === group.id} onOpenChange={(open) => {
                      setAddEntityDialogOpen(open);
                      if (open) setSelectedGroupForAdd(group.id);
                    }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Plus className="h-3 w-3 mr-1" />
                          Add Entity
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Entity to "{group.name}"</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                          <Select value={selectedEntityForAdd} onValueChange={setSelectedEntityForAdd}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select an entity..." />
                            </SelectTrigger>
                            <SelectContent>
                              {unassignedEntities.length > 0 ? (
                                unassignedEntities.map(e => (
                                  <SelectItem key={e.id} value={e.id}>
                                    {e.name} ({e.entity_type})
                                  </SelectItem>
                                ))
                              ) : (
                                <div className="p-2 text-sm text-muted-foreground">
                                  All entities are already assigned to groups
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <DialogFooter>
                          <Button 
                            onClick={handleAddEntityToGroup} 
                            disabled={!selectedEntityForAdd || addMapping.isPending}
                          >
                            {addMapping.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Add to Group
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-destructive"
                      onClick={() => handleDeleteGroup(group.id)}
                      disabled={deleteGroup.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Group Members */}
                {group.entity_beneficial_mapping && group.entity_beneficial_mapping.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pl-7">
                    {group.entity_beneficial_mapping.map((mapping) => (
                      <Badge 
                        key={mapping.id} 
                        variant="secondary"
                        className="gap-1 py-1.5 px-3"
                      >
                        {mapping.ownership_entities?.name}
                        <span className="text-xs text-muted-foreground ml-1">
                          ({mapping.ownership_entities?.entity_type})
                        </span>
                        <button
                          onClick={() => handleRemoveEntityFromGroup(mapping.id)}
                          className="ml-1 hover:text-destructive"
                          disabled={removeMapping.isPending}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground pl-7">
                    No entities in this group. Add entities to include them in attribution calculations.
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">
            No beneficial groups created yet. Create a group to start mapping entities.
          </p>
        )}

        {/* Info Box */}
        <div className="bg-muted/50 rounded-lg p-4 text-sm">
          <h4 className="font-medium mb-2">How Attribution Works</h4>
          <ul className="space-y-1 text-muted-foreground list-disc pl-4">
            <li>Entities in the same beneficial group are treated as a single owner for reporting</li>
            <li>Dashboard and Insights can show "Gross" (100%) or "Attributable" (your share) metrics</li>
            <li>Attribution is calculated by looking through SPV ownership to ultimate shareholders</li>
            <li>Example: If you own 50% of an SPV that owns a property, your attributable share is 50%</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
