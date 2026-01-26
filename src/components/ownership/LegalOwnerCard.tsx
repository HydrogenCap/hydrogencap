import React from 'react';
import { Building2, Pencil, Plus, ExternalLink, Calendar, MapPin, RefreshCw, User, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useProperty } from '@/hooks/useProperties';
import { useCompany, useUpdateCompany } from '@/hooks/useCompanies';
import { usePropertyBeneficialOwnership, getOwnerName } from '@/hooks/useOwnershipLinks';
import { useCompaniesHouse } from '@/hooks/useCompaniesHouse';
import { ComplianceStatusBadge } from '@/components/companies/ComplianceStatusBadge';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { formatPercent } from '@/lib/calculations';

interface LegalOwnerCardProps {
  propertyId: string;
  onEdit: () => void;
}

export function LegalOwnerCard({ propertyId, onEdit }: LegalOwnerCardProps) {
  const { data: property, isLoading: propertyLoading } = useProperty(propertyId);
  const { data: company, isLoading: companyLoading } = useCompany(
    property?.legal_owner_company_id || undefined
  );
  const { data: directOwners, isLoading: directOwnersLoading } = usePropertyBeneficialOwnership(propertyId);
  const { lookupCompany, isLookingUp } = useCompaniesHouse();
  const updateCompany = useUpdateCompany();
  const { toast } = useToast();

  const handleSyncFromCH = async () => {
    if (!company?.company_number || !company?.id) return;

    try {
      const result = await lookupCompany(company.company_number);
      if (result) {
        await updateCompany.mutateAsync({
          id: company.id,
          ch_registered_address: result.company.registered_address,
          ch_incorporation_date: result.company.date_of_creation,
          ch_last_synced_at: new Date().toISOString(),
          accounts_due_date: result.compliance.accounts_due_date,
          accounts_period_end: result.compliance.accounts_period_end,
          accounts_last_filed_date: result.compliance.accounts_last_filed_date,
          confirmation_statement_due_date: result.compliance.confirmation_statement_due_date,
          confirmation_statement_last_made_up_to: result.compliance.confirmation_statement_last_made_up_to,
          confirmation_statement_last_filed_date: result.compliance.confirmation_statement_last_filed_date,
        });
        toast({ title: 'Synced from Companies House', description: 'Company data updated.' });
      }
    } catch (error) {
      toast({ title: 'Sync failed', description: 'Could not fetch data from Companies House.', variant: 'destructive' });
    }
  };

  if (propertyLoading || directOwnersLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Legal Owner</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasCompanyOwner = !!property?.legal_owner_company_id;
  const hasIndividualOwners = (directOwners?.length || 0) > 0;

  // No owner set
  if (!hasCompanyOwner && !hasIndividualOwners) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Legal Owner</CardTitle>
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

  // Multiple individual owners
  if (hasIndividualOwners && !hasCompanyOwner) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Legal Owners (Joint)
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {directOwners?.map((owner) => (
            <div
              key={owner.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{getOwnerName(owner)}</p>
                  <Badge variant="outline" className="text-xs">Individual</Badge>
                </div>
              </div>
              <span className="text-lg font-bold">{formatPercent(Number(owner.percent))}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // Company owner (existing logic)
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
                      <a 
                        href={`https://find-and-update.company-information.service.gov.uk/company/${company.company_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        #{company.company_number}
                      </a>
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
                to={`/companies/${property?.legal_owner_company_id}`}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                View Company
              </Link>
            </div>
          </div>
        </div>

        {/* Company Details from Companies House */}
        {company && !companyLoading && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Companies House Data</span>
              {company.company_number && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSyncFromCH}
                  disabled={isLookingUp || updateCompany.isPending}
                  className="h-7 text-xs"
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${isLookingUp || updateCompany.isPending ? 'animate-spin' : ''}`} />
                  Sync
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {company.ch_incorporation_date && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Inc. {new Date(company.ch_incorporation_date).toLocaleDateString()}</span>
                </div>
              )}
              {company.ch_registered_address && (
                <div className="flex items-start gap-2 text-muted-foreground col-span-2">
                  <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span className="text-xs">{company.ch_registered_address}</span>
                </div>
              )}
            </div>

            {/* Compliance Status */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Accounts Due</span>
                <ComplianceStatusBadge
                  dueDate={company.accounts_due_date}
                  compact
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Confirmation Due</span>
                <ComplianceStatusBadge
                  dueDate={company.confirmation_statement_due_date}
                  compact
                />
              </div>
            </div>

            {company.ch_last_synced_at && (
              <p className="text-xs text-muted-foreground text-right">
                Last synced {formatDistanceToNow(new Date(company.ch_last_synced_at), { addSuffix: true })}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
