import React from 'react';
import { Building2, Pencil, Plus, Link as LinkIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useLegalOwnership, type LegalOwnershipWithEntity } from '@/hooks/useOwnershipLookthrough';
import { formatPercent } from '@/lib/calculations';

interface LegalOwnerCardProps {
  propertyId: string;
  onEdit: (ownership: LegalOwnershipWithEntity) => void;
  onAdd: () => void;
}

export function LegalOwnerCard({ propertyId, onEdit, onAdd }: LegalOwnerCardProps) {
  const { data: legalOwners, isLoading } = useLegalOwnership(propertyId);

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Legal Owner (SPV)</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const primaryOwner = legalOwners?.[0];
  const hasMultipleOwners = legalOwners && legalOwners.length > 1;

  if (!primaryOwner) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Legal Owner (SPV)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border-2 border-dashed border-muted">
            <p className="text-sm text-muted-foreground">No legal owner recorded</p>
            <Button variant="outline" size="sm" onClick={onAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Set Legal Owner
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const entity = primaryOwner.ownership_entities;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Legal Owner (SPV)</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onEdit(primaryOwner)}>
            <Pencil className="h-4 w-4 mr-2" />
            Change
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">{entity.name}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline" className="text-xs">{entity.entity_type}</Badge>
                {primaryOwner.notes && <span>• {primaryOwner.notes}</span>}
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xl font-bold">{formatPercent(Number(primaryOwner.owner_percent))}</span>
            {primaryOwner.owning_company_id && (
              <div className="mt-1">
                <Link 
                  to={`/companies/${primaryOwner.owning_company_id}`}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <LinkIcon className="h-3 w-3" />
                  View Company
                </Link>
              </div>
            )}
          </div>
        </div>

        {hasMultipleOwners && (
          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground font-medium">Other Owners</p>
            {legalOwners.slice(1).map((owner) => (
              <div 
                key={owner.id} 
                className="flex items-center justify-between p-2 rounded bg-muted/30 group"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{owner.ownership_entities.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{formatPercent(Number(owner.owner_percent))}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 opacity-0 group-hover:opacity-100"
                    onClick={() => onEdit(owner)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
