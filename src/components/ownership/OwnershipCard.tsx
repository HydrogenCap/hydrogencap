import React from 'react';
import { Building2, User, Users, Briefcase, Plus, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  usePropertyOwnership,
  useDeletePropertyOwnership,
  type PropertyOwnershipWithEntity,
} from '@/hooks/useOwnership';
import { formatPercent } from '@/lib/calculations';
import { useToast } from '@/hooks/use-toast';

interface OwnershipCardProps {
  propertyId: string;
  onAddOwnership: (level: 'Property' | 'SPV_Shareholding') => void;
  onEditOwnership: (ownership: PropertyOwnershipWithEntity) => void;
}

const entityTypeIcons: Record<string, React.ReactNode> = {
  Person: <User className="h-4 w-4" />,
  Company: <Building2 className="h-4 w-4" />,
  SPV: <Briefcase className="h-4 w-4" />,
  Investor: <Users className="h-4 w-4" />,
};

export function OwnershipCard({ propertyId, onAddOwnership, onEditOwnership }: OwnershipCardProps) {
  const { data: ownership, isLoading } = usePropertyOwnership(propertyId);
  const deleteOwnership = useDeletePropertyOwnership();
  const { toast } = useToast();

  const propertyOwnership = ownership?.filter(o => o.ownership_level === 'Property') ?? [];
  const spvShareholding = ownership?.filter(o => o.ownership_level === 'SPV_Shareholding') ?? [];
  
  const propertyTotal = propertyOwnership.reduce((sum, o) => sum + Number(o.ownership_percent), 0);
  const spvTotal = spvShareholding.reduce((sum, o) => sum + Number(o.ownership_percent), 0);

  const handleDelete = async (id: string) => {
    try {
      await deleteOwnership.mutateAsync({ id, propertyId });
      toast({ title: 'Ownership removed' });
    } catch (error) {
      console.error('Failed to remove ownership:', error);
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to remove ownership', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Ownership</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span>Ownership</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Property Ownership Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-muted-foreground">Property Ownership</h4>
            <div className="flex items-center gap-2">
              {propertyTotal > 0 && (
                <Badge variant={propertyTotal === 100 ? 'default' : 'outline'} className={propertyTotal !== 100 ? 'text-warning' : ''}>
                  {formatPercent(propertyTotal)} total
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={() => onAddOwnership('Property')}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {propertyOwnership.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No ownership records</p>
          ) : (
            <div className="space-y-2">
              {propertyOwnership.map(o => (
                <OwnershipRow
                  key={o.id}
                  ownership={o}
                  onEdit={() => onEditOwnership(o)}
                  onDelete={() => handleDelete(o.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* SPV Shareholding Section */}
        <div className="space-y-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-muted-foreground">SPV Shareholding</h4>
            <div className="flex items-center gap-2">
              {spvTotal > 0 && (
                <Badge variant="outline">
                  {formatPercent(spvTotal)} total
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={() => onAddOwnership('SPV_Shareholding')}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {spvShareholding.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No shareholding records</p>
          ) : (
            <div className="space-y-2">
              {spvShareholding.map(o => (
                <OwnershipRow
                  key={o.id}
                  ownership={o}
                  onEdit={() => onEditOwnership(o)}
                  onDelete={() => handleDelete(o.id)}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface OwnershipRowProps {
  ownership: PropertyOwnershipWithEntity;
  onEdit: () => void;
  onDelete: () => void;
}

function OwnershipRow({ ownership, onEdit, onDelete }: OwnershipRowProps) {
  const entity = ownership.ownership_entities;
  
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 group">
      <div className="flex items-center gap-3">
        <div className="text-muted-foreground">
          {entityTypeIcons[entity.entity_type] || <Building2 className="h-4 w-4" />}
        </div>
        <div>
          <p className="font-medium text-sm">{entity.name}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{entity.entity_type}</span>
            {ownership.notes && (
              <>
                <span>•</span>
                <span className="truncate max-w-32">{ownership.notes}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="font-mono">
          {formatPercent(Number(ownership.ownership_percent))}
        </Badge>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
