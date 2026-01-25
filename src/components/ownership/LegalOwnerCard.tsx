import React from 'react';
import { Building2, Pencil, Plus, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useProperty } from '@/hooks/useProperties';
import { useCompany } from '@/hooks/useCompanies';

interface LegalOwnerCardProps {
  propertyId: string;
  onEdit: () => void;
}

export function LegalOwnerCard({ propertyId, onEdit }: LegalOwnerCardProps) {
  const { data: property, isLoading: propertyLoading } = useProperty(propertyId);
  const { data: company, isLoading: companyLoading } = useCompany(
    property?.legal_owner_company_id || undefined
  );

  if (propertyLoading) {
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

  if (!property?.legal_owner_company_id) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Legal Owner (SPV)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border-2 border-dashed border-muted">
            <p className="text-sm text-muted-foreground">No legal owner recorded</p>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Plus className="h-4 w-4 mr-2" />
              Set Legal Owner
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Legal Owner (SPV)</CardTitle>
          <Button variant="ghost" size="sm" onClick={onEdit}>
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
              {companyLoading ? (
                <Skeleton className="h-5 w-32" />
              ) : company ? (
                <>
                  <p className="font-medium">{company.legal_name}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="outline" className="text-xs">{company.company_type}</Badge>
                    {company.company_number && (
                      <span className="text-xs">#{company.company_number}</span>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">Company not found</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <span className="text-xl font-bold">100%</span>
            <div className="mt-1">
              <Link 
                to={`/companies/${property.legal_owner_company_id}`}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                View Company
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
