import React, { useState } from 'react';
import { Building2, User, Users, Briefcase, Plus, Edit2, Trash2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  useLegalOwnership,
  useEntityShareholdings,
  useDeleteLegalOwnership,
  useDeleteShareholding,
  useEffectiveOwnership,
  calculateOwnershipSum,
  validateOwnershipSum,
  type LegalOwnershipWithEntity,
  type ShareholdingWithEntity,
  type EffectiveOwnership,
} from '@/hooks/useOwnershipLookthrough';
import { useToast } from '@/hooks/use-toast';
import { formatPercent } from '@/lib/calculations';

interface LegalOwnershipCardProps {
  propertyId: string;
  onAddLegalOwner: () => void;
  onEditLegalOwner: (ownership: LegalOwnershipWithEntity) => void;
  onAddShareholder: (parentEntityId: string) => void;
  onEditShareholder: (shareholding: ShareholdingWithEntity, parentEntityId: string) => void;
}

const ENTITY_ICONS = {
  Person: User,
  Company: Building2,
  SPV: Briefcase,
  Investor: Users,
  Other: Users,
};

function getEntityIcon(entityType: string) {
  return ENTITY_ICONS[entityType as keyof typeof ENTITY_ICONS] || Users;
}

interface ShareholdingsSectionProps {
  entityId: string;
  entityName: string;
  onAddShareholder: (parentEntityId: string) => void;
  onEditShareholder: (shareholding: ShareholdingWithEntity, parentEntityId: string) => void;
}

function ShareholdingsSection({ entityId, entityName, onAddShareholder, onEditShareholder }: ShareholdingsSectionProps) {
  const { data: shareholdings, isLoading } = useEntityShareholdings(entityId);
  const deleteShareholder = useDeleteShareholding();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(true);

  if (isLoading) {
    return <Skeleton className="h-20 w-full mt-2" />;
  }

  const shareholdingSum = calculateOwnershipSum(shareholdings || []);
  const isValidSum = validateOwnershipSum(shareholdingSum);

  const handleDelete = async (id: string) => {
    try {
      await deleteShareholder.mutateAsync({ id, parentEntityId: entityId });
      toast({ title: 'Shareholder removed' });
    } catch (error) {
      console.error('Failed to remove shareholder:', error);
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to remove shareholder', variant: 'destructive' });
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="ml-6 mt-2 border-l-2 border-muted pl-4">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
          <span>Shareholders of {entityName}</span>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 mt-2">
        {shareholdings && shareholdings.length > 0 ? (
          <>
            {!isValidSum && (
              <div className="flex items-center gap-2 text-warning text-sm mb-2">
                <AlertCircle className="h-4 w-4" />
                <span>Shareholdings sum to {formatPercent(shareholdingSum)} (should be 100%)</span>
              </div>
            )}
            {shareholdings.map(shareholding => {
              const Icon = getEntityIcon(shareholding.shareholder_entity.entity_type);
              return (
                <div
                  key={shareholding.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30 group"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-sm">{shareholding.shareholder_entity.name}</span>
                      <Badge variant="outline" className="ml-2 text-xs">
                        {shareholding.shareholder_entity.entity_type}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{formatPercent(Number(shareholding.shareholder_percent))}</span>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onEditShareholder(shareholding, entityId)}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete(shareholding.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No shareholders recorded</p>
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => onAddShareholder(entityId)}
        >
          <Plus className="h-3 w-3 mr-2" />
          Add Shareholder
        </Button>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function LegalOwnershipCard({
  propertyId,
  onAddLegalOwner,
  onEditLegalOwner,
  onAddShareholder,
  onEditShareholder,
}: LegalOwnershipCardProps) {
  const { data: legalOwners, isLoading } = useLegalOwnership(propertyId);
  const { data: effectiveOwnership } = useEffectiveOwnership(propertyId);
  const deleteLegalOwner = useDeleteLegalOwnership();
  const { toast } = useToast();

  const handleDeleteLegalOwner = async (id: string) => {
    try {
      await deleteLegalOwner.mutateAsync({ id, propertyId });
      toast({ title: 'Legal owner removed' });
    } catch (error) {
      console.error('Failed to remove legal owner:', error);
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to remove legal owner', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Ownership Structure</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const legalOwnershipSum = calculateOwnershipSum(legalOwners || []);
  const isValidLegalSum = validateOwnershipSum(legalOwnershipSum);

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Ownership Structure
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Legal Ownership Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Legal Ownership (Title Level)
            </h4>
            <Button variant="outline" size="sm" onClick={onAddLegalOwner}>
              <Plus className="h-3 w-3 mr-2" />
              Add Owner
            </Button>
          </div>

          {!isValidLegalSum && legalOwners && legalOwners.length > 0 && (
            <div className="flex items-center gap-2 text-warning text-sm mb-3">
              <AlertCircle className="h-4 w-4" />
              <span>Legal ownership sums to {formatPercent(legalOwnershipSum)} (should be 100%)</span>
            </div>
          )}

          {legalOwners && legalOwners.length > 0 ? (
            <div className="space-y-2">
              {legalOwners.map(owner => {
                const entity = owner.ownership_entities;
                const Icon = getEntityIcon(entity.entity_type);
                const isCompanyType = entity.entity_type === 'SPV' || entity.entity_type === 'Company';

                return (
                  <div key={owner.id}>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 group">
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-primary" />
                        <div>
                          <span className="font-medium">{entity.name}</span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            {entity.entity_type}
                          </Badge>
                          {owner.notes && (
                            <p className="text-xs text-muted-foreground mt-1">{owner.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold">{formatPercent(Number(owner.owner_percent))}</span>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onEditLegalOwner(owner)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDeleteLegalOwner(owner.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Show shareholdings section for SPVs/Companies */}
                    {isCompanyType && (
                      <ShareholdingsSection
                        entityId={entity.id}
                        entityName={entity.name}
                        onAddShareholder={onAddShareholder}
                        onEditShareholder={onEditShareholder}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              No legal ownership recorded
            </p>
          )}
        </div>

        {/* Effective Ownership Summary */}
        {effectiveOwnership && effectiveOwnership.length > 0 && (
          <div className="border-t border-border pt-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-3">
              Look-Through Effective Ownership
            </h4>
            <div className="grid gap-2">
              {effectiveOwnership.map((owner: EffectiveOwnership) => {
                const Icon = getEntityIcon(owner.entityType);
                return (
                  <div
                    key={owner.entityId}
                    className="flex items-center justify-between p-2 rounded-lg bg-primary/5"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="text-sm">{owner.entityName}</span>
                    </div>
                    <span className="font-medium text-primary">
                      {formatPercent(owner.effectivePercent)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}