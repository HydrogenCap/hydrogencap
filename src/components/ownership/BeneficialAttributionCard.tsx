import React, { useState, useEffect } from 'react';
import { Users, Star, AlertTriangle, Edit2, Check, X, Plus, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatPercent } from '@/lib/calculations';
import { useToast } from '@/hooks/use-toast';
import {
  usePropertyAttributableOwnership,
  useBeneficialGroups,
  useAddEntityMapping,
  useRemoveEntityMapping,
  useUpdatePropertyBeneficialOverride,
  useSeedDefaultBeneficialGroup,
  type EffectiveOwnershipWithBenefit,
} from '@/hooks/useBeneficialGroups';
import { useOwnershipEntities } from '@/hooks/useOwnershipLookthrough';

interface BeneficialAttributionCardProps {
  propertyId: string;
}

export function BeneficialAttributionCard({ propertyId }: BeneficialAttributionCardProps) {
  const { toast } = useToast();
  const { data: attribution, isLoading } = usePropertyAttributableOwnership(propertyId);
  const { data: groups, isLoading: groupsLoading } = useBeneficialGroups();
  const { data: entities } = useOwnershipEntities();
  const seedDefault = useSeedDefaultBeneficialGroup();
  const addMapping = useAddEntityMapping();
  const removeMapping = useRemoveEntityMapping();
  const updateOverride = useUpdatePropertyBeneficialOverride();

  const [editingOverride, setEditingOverride] = useState(false);
  const [overrideValue, setOverrideValue] = useState<string>('');
  const [overrideNotes, setOverrideNotes] = useState<string>('');
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>('');

  // Seed default group if none exists
  useEffect(() => {
    if (!groupsLoading && groups && groups.length === 0) {
      seedDefault.mutate();
    }
  }, [groups, groupsLoading, seedDefault]);

  const primaryGroup = groups?.[0];

  const handleSaveOverride = async () => {
    try {
      const value = overrideValue ? parseFloat(overrideValue) : null;
      await updateOverride.mutateAsync({
        propertyId,
        overridePercent: value,
        notes: overrideNotes || null,
      });
      setEditingOverride(false);
      toast({ title: 'Override saved' });
    } catch {
      toast({ title: 'Error', description: 'Failed to save override', variant: 'destructive' });
    }
  };

  const handleClearOverride = async () => {
    try {
      await updateOverride.mutateAsync({
        propertyId,
        overridePercent: null,
        notes: null,
      });
      setEditingOverride(false);
      setOverrideValue('');
      setOverrideNotes('');
      toast({ title: 'Override cleared' });
    } catch {
      toast({ title: 'Error', description: 'Failed to clear override', variant: 'destructive' });
    }
  };

  const handleAssignEntity = async () => {
    if (!selectedEntity || !selectedGroup) return;

    try {
      await addMapping.mutateAsync({
        entity_id: selectedEntity,
        beneficial_group_id: selectedGroup,
      });
      setAssignDialogOpen(false);
      setSelectedEntity('');
      toast({ title: 'Entity assigned to beneficial group' });
    } catch (e: any) {
      toast({ 
        title: 'Error', 
        description: e.message?.includes('unique') ? 'Entity already in this group' : 'Failed to assign entity', 
        variant: 'destructive' 
      });
    }
  };

  if (isLoading || groupsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Beneficial Attribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const entitiesInGroup = new Set(
    primaryGroup?.entity_beneficial_mapping?.map((m) => m.ownership_entities?.id) || []
  );

  // Find entities that are NOT in any group for the assign dropdown
  const unassignedEntities = entities?.filter(e => !entitiesInGroup.has(e.id)) || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Beneficial Attribution
          </CardTitle>
          <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-3 w-3 mr-1" />
                Assign Entity
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Entity to Beneficial Group</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Entity</label>
                  <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an entity..." />
                    </SelectTrigger>
                    <SelectContent>
                      {unassignedEntities.map(e => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name} ({e.entity_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Beneficial Group</label>
                  <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a group..." />
                    </SelectTrigger>
                    <SelectContent>
                      {groups?.map(g => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleAssignEntity}
                  disabled={!selectedEntity || !selectedGroup || addMapping.isPending}
                >
                  {addMapping.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Assign to Group
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Warnings */}
        {attribution?.warnings && attribution.warnings.length > 0 && (
          <Alert variant="destructive" className="bg-warning/10 border-warning text-warning-foreground">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc pl-4 space-y-1">
                {attribution.warnings.map((w, i) => (
                  <li key={i} className="text-sm">{w}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 text-center p-4 rounded-lg bg-muted/50">
          <div>
            <div className="text-sm text-muted-foreground">Gross</div>
            <div className="text-2xl font-bold">{formatPercent(attribution?.grossPercent || 100)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Calculated</div>
            <div className="text-2xl font-bold">{formatPercent(attribution?.attributablePercent || 0)}</div>
          </div>
          <div className={attribution?.hasOverride ? 'ring-2 ring-primary/20 rounded-lg p-2 -m-2' : ''}>
            <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              Effective
              {attribution?.hasOverride && <Badge variant="outline" className="text-xs ml-1">Override</Badge>}
            </div>
            <div className="text-2xl font-bold text-primary">
              {formatPercent(attribution?.effectiveAttributablePercent || 0)}
            </div>
          </div>
        </div>

        {/* Override Editor */}
        <div className="border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Property Override</span>
            {!editingOverride && (
              <Button variant="ghost" size="sm" onClick={() => {
                setEditingOverride(true);
                setOverrideValue(attribution?.overridePercent?.toString() || '');
              }}>
                <Edit2 className="h-3 w-3 mr-1" />
                {attribution?.hasOverride ? 'Edit' : 'Set Override'}
              </Button>
            )}
          </div>
          {editingOverride ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={overrideValue}
                  onChange={(e) => setOverrideValue(e.target.value)}
                  placeholder="e.g., 100"
                  className="w-24"
                />
                <span className="text-muted-foreground">%</span>
              </div>
              <Input
                placeholder="Reason for override..."
                value={overrideNotes}
                onChange={(e) => setOverrideNotes(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveOverride} disabled={updateOverride.isPending}>
                  <Check className="h-3 w-3 mr-1" /> Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingOverride(false)}>
                  <X className="h-3 w-3 mr-1" /> Cancel
                </Button>
                {attribution?.hasOverride && (
                  <Button size="sm" variant="destructive" onClick={handleClearOverride}>
                    Clear
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {attribution?.hasOverride 
                ? `Treating as ${formatPercent(attribution.overridePercent || 0)} attributable`
                : 'No override set — using calculated value from ownership structure'
              }
            </p>
          )}
        </div>

        {/* Effective Ownership Breakdown */}
        <div>
          <h4 className="text-sm font-medium mb-2">Effective Ownership Breakdown</h4>
          {attribution?.effectiveOwnership && attribution.effectiveOwnership.length > 0 ? (
            <div className="space-y-2">
              {attribution.effectiveOwnership.map((owner: EffectiveOwnershipWithBenefit) => (
                <div
                  key={owner.entityId}
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    owner.isAttributableToMe 
                      ? 'bg-primary/10 border border-primary/20' 
                      : 'bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {owner.isAttributableToMe && (
                      <Star className="h-4 w-4 text-primary fill-primary" />
                    )}
                    <div>
                      <span className="text-sm font-medium">{owner.entityName}</span>
                      <Badge variant="outline" className="ml-2 text-xs">
                        {owner.entityType}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${owner.isAttributableToMe ? 'text-primary' : ''}`}>
                      {formatPercent(owner.effectivePercent)}
                    </span>
                    {owner.isAttributableToMe && (
                      <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                        Attributable to Me
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No ownership structure recorded
            </p>
          )}
        </div>

        {/* Beneficial Group Members */}
        {primaryGroup && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              "{primaryGroup.name}" Group Members
            </h4>
            {primaryGroup.entity_beneficial_mapping && primaryGroup.entity_beneficial_mapping.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {primaryGroup.entity_beneficial_mapping.map((mapping) => (
                  <Badge 
                    key={mapping.id} 
                    variant="secondary"
                    className="gap-1"
                  >
                    {mapping.ownership_entities?.name}
                    <button
                      onClick={() => {
                        removeMapping.mutate(mapping.id);
                        toast({ title: 'Entity removed from group' });
                      }}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No entities assigned to this group yet
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
