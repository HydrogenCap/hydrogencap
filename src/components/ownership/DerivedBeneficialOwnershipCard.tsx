import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, User, Users, ExternalLink, AlertCircle, Check, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useProperty } from '@/hooks/useProperties';
import { useCompany } from '@/hooks/useCompanies';
import {
  useCompanyOwnership,
  calculateOwnershipTotal,
  validateOwnershipTotal,
  getOwnerName,
  getOwnerType,
} from '@/hooks/useOwnershipLinks';
import { formatPercent } from '@/lib/calculations';

interface DerivedBeneficialOwnershipCardProps {
  propertyId: string;
}

export function DerivedBeneficialOwnershipCard({ propertyId }: DerivedBeneficialOwnershipCardProps) {
  const { data: property, isLoading: propertyLoading } = useProperty(propertyId);
  const { data: company, isLoading: companyLoading } = useCompany(
    property?.legal_owner_company_id || undefined
  );
  const { data: shareholders, isLoading: shareholdersLoading, refetch } = useCompanyOwnership(
    property?.legal_owner_company_id || undefined
  );

  const isLoading = propertyLoading || companyLoading || shareholdersLoading;

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Beneficial Ownership Split
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  // No legal owner company
  if (!property?.legal_owner_company_id) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Beneficial Ownership Split
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Set a Legal Owner (SPV) above to see the beneficial ownership split.
              The beneficial owners are derived from the company's shareholders.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const activeLinks = shareholders || [];
  const total = calculateOwnershipTotal(activeLinks);
  const isValid = validateOwnershipTotal(total);
  const remaining = 100 - total;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Beneficial Ownership Split
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="h-7 text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Refresh
            </Button>
            {company && (
              <Link to={`/companies/${company.id}`}>
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Edit on Company
                </Button>
              </Link>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Source indicator */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
          <Building2 className="h-4 w-4" />
          <span>
            Derived from shareholders of{' '}
            <Link
              to={`/companies/${company?.id}`}
              className="font-medium text-primary hover:underline"
            >
              {company?.legal_name}
            </Link>
          </span>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total allocation</span>
            <span className={`font-medium ${isValid ? 'text-success' : total > 100 ? 'text-destructive' : 'text-warning'}`}>
              {formatPercent(total)}
            </span>
          </div>
          <Progress value={Math.min(total, 100)} className="h-2" />
          {remaining > 0.5 && (
            <p className="text-xs text-muted-foreground">{formatPercent(remaining)} unallocated</p>
          )}
        </div>

        {/* Status Alert */}
        {!isValid && activeLinks.length > 0 && (
          <Alert variant={total > 100 ? 'destructive' : 'default'} className="border-warning bg-warning/10">
            <AlertCircle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-warning">
              Company ownership is {formatPercent(total)} — must equal 100%
            </AlertDescription>
          </Alert>
        )}
        {isValid && activeLinks.length > 0 && (
          <Alert className="border-success bg-success/10">
            <Check className="h-4 w-4 text-success" />
            <AlertDescription className="text-success">
              Beneficial ownership fully allocated
            </AlertDescription>
          </Alert>
        )}

        {activeLinks.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-muted rounded-lg text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              No shareholders recorded for {company?.legal_name}
            </p>
            <Link to={`/companies/${company?.id}`}>
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                Add Shareholders on Company Page
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {activeLinks.map((link) => {
              const isCompany = link.owner_party?.party_type === 'COMPANY';
              return (
                <div
                  key={link.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-background">
                      {isCompany ? (
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <User className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <span className="font-medium">{getOwnerName(link)}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-xs">
                          {getOwnerType(link)}
                        </Badge>
                        {link.source && (
                          <Badge variant="secondary" className="text-xs capitalize">
                            {link.source}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold">{formatPercent(Number(link.percent))}</span>
                    {link.shares && (
                      <p className="text-xs text-muted-foreground">
                        {link.shares.toLocaleString()} shares
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
