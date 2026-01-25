import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, Users, ExternalLink, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useLegalOwnership } from '@/hooks/useOwnershipLookthrough';
import { useBeneficialOwners, calculateBeneficialSum, getOwnerDisplayName } from '@/hooks/useBeneficialOwnership';

interface PassportOwnershipSummaryProps {
  propertyId: string;
}

export function PassportOwnershipSummary({ propertyId }: PassportOwnershipSummaryProps) {
  const { data: legalOwners, isLoading: loadingLegal } = useLegalOwnership(propertyId);
  const { data: beneficialOwners, isLoading: loadingBeneficial } = useBeneficialOwners(propertyId);

  const isLoading = loadingLegal || loadingBeneficial;

  // Get active beneficial owners
  const activeBeneficial = beneficialOwners?.filter(o => !o.end_date) || [];
  const beneficialSum = calculateBeneficialSum(activeBeneficial);
  const beneficialIncomplete = Math.abs(beneficialSum - 100) > 0.5;

  // Get primary legal owner (first one with highest %)
  const primaryLegalOwner = legalOwners?.[0];
  const legalOwnerName = primaryLegalOwner?.ownership_entities?.name || null;
  const legalOwnerCompanyId = primaryLegalOwner?.owning_company_id;

  if (isLoading) {
    return (
      <Card className="bg-muted/30 border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Ownership Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardContent>
      </Card>
    );
  }

  const hasNoOwnership = !primaryLegalOwner && activeBeneficial.length === 0;

  return (
    <Card className="bg-muted/30 border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            Ownership Summary
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <a href="#ownership-section" className="text-primary">
              Edit Ownership
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasNoOwnership ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            <span>No ownership records. <a href="#ownership-section" className="text-primary underline">Add ownership</a></span>
          </div>
        ) : (
          <>
            {/* Legal Owner */}
            <div className="flex items-start gap-3">
              <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Legal Owner (SPV)</p>
                {legalOwnerName ? (
                  <div className="flex items-center gap-2">
                    {legalOwnerCompanyId ? (
                      <Link
                        to={`/companies/${legalOwnerCompanyId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {legalOwnerName}
                      </Link>
                    ) : (
                      <span className="font-medium">{legalOwnerName}</span>
                    )}
                    {primaryLegalOwner?.owner_percent && primaryLegalOwner.owner_percent !== 100 && (
                      <Badge variant="secondary" className="text-xs">
                        {primaryLegalOwner.owner_percent}%
                      </Badge>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground italic">Not set</span>
                )}
              </div>
            </div>

            {/* Beneficial Owners */}
            <div className="flex items-start gap-3">
              <Users className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">Beneficial Owners</p>
                  {beneficialIncomplete && activeBeneficial.length > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {beneficialSum.toFixed(0)}% (incomplete)
                    </Badge>
                  )}
                </div>
                {activeBeneficial.length > 0 ? (
                  <div className="mt-1 space-y-1">
                    {activeBeneficial.slice(0, 4).map((owner) => (
                      <div key={owner.id} className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{getOwnerDisplayName(owner)}</span>
                        <span className="text-muted-foreground">
                          {owner.beneficial_percent}%
                        </span>
                      </div>
                    ))}
                    {activeBeneficial.length > 4 && (
                      <p className="text-xs text-muted-foreground">
                        +{activeBeneficial.length - 4} more
                      </p>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground italic">Not set</span>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
