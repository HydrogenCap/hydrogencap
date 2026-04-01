import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Building2, User, Users, ExternalLink, AlertCircle, Check, RefreshCw, Plus, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useProperty } from '@/hooks/useProperties';
import { useCompany } from '@/hooks/useCompanies';
import { useParty } from '@/hooks/useParties';
import {
  usePropertyBeneficialOwnership,
  useCompanyOwnership,
  useDeleteOwnershipLink,
  calculateOwnershipTotal,
  validateOwnershipTotal,
  getOwnerName,
  getOwnerType,
  type OwnershipLink,
} from '@/hooks/useOwnershipLinks';
import { UnifiedOwnershipEditor } from './UnifiedOwnershipEditor';
import { formatPercent } from '@/lib/calculations';
import { useToast } from '@/hooks/use-toast';

interface DerivedBeneficialOwnershipCardProps {
  propertyId: string;
}

// Helper to display shareholders from ownership_links
interface ShareholderDisplay {
  id: string;
  name: string;
  partyType: string;
  percent: number;
  shares: number;
  source: string;
}

function mapOwnershipLinksToShareholders(links: OwnershipLink[]): ShareholderDisplay[] {
  return links.map((link) => ({
    id: link.id,
    name: link.owner_party?.display_name || 'Unknown',
    partyType: link.owner_party?.party_type || 'INDIVIDUAL',
    percent: Number(link.percent),
    shares: link.shares || 0,
    source: link.source || 'manual',
  })).sort((a, b) => b.percent - a.percent);
}

export function DerivedBeneficialOwnershipCard({ propertyId }: DerivedBeneficialOwnershipCardProps) {
  const { data: property, isLoading: propertyLoading } = useProperty(propertyId);
  const { data: companyWithDetails, isLoading: companyLoading } = useCompany(
    property?.legal_owner_company_id || undefined
  );
  const { data: companyOwnershipLinks, isLoading: companyOwnershipLoading, refetch: refetchCompanyOwnership } = useCompanyOwnership(
    property?.legal_owner_company_id || undefined
  );
  const { data: party, isLoading: partyLoading } = useParty(
    property?.legal_owner_party_id || undefined
  );
  const { data: directOwners, isLoading: directOwnersLoading, refetch: refetchDirectOwners } = usePropertyBeneficialOwnership(propertyId);
  const deleteOwnership = useDeleteOwnershipLink();
  const { toast } = useToast();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<OwnershipLink | null>(null);

  const isLoading = propertyLoading || companyLoading || companyOwnershipLoading || partyLoading || directOwnersLoading;

  // Map ownership links to shareholder display format
  const shareholders = useMemo(() => {
    if (!companyOwnershipLinks || companyOwnershipLinks.length === 0) {
      return [];
    }
    return mapOwnershipLinksToShareholders(companyOwnershipLinks);
  }, [companyOwnershipLinks]);

  const handleAddOwner = () => {
    setEditingLink(null);
    setEditorOpen(true);
  };

  const handleEditOwner = (link: OwnershipLink) => {
    setEditingLink(link);
    setEditorOpen(true);
  };

  const handleDeleteOwner = async (link: OwnershipLink) => {
    if (!confirm(`Remove ${getOwnerName(link)} as beneficial owner?`)) return;
    try {
      await deleteOwnership.mutateAsync({
        id: link.id,
        subjectType: 'PROPERTY',
        subjectId: propertyId,
      });
    } catch (err) {
      console.error('Failed to delete ownership:', err);
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Something went wrong', variant: 'destructive' });
    }
  };

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

  // Determine which mode we're in
  const hasCompanyOwner = !!property?.legal_owner_company_id;
  const hasSinglePersonOwner = !!property?.legal_owner_party_id && party;
  const hasDirectOwners = (directOwners?.length || 0) > 0;

  // MODE 1: Owned by a company (SPV) - derive from shareholders
  if (hasCompanyOwner && companyWithDetails) {
    const total = shareholders.reduce((sum, sh) => sum + sh.percent, 0);
    const isValid = Math.abs(total - 100) <= 0.5;
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
                onClick={() => refetchCompanyOwnership()}
                className="h-7 text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
              <Link to={`/companies/${companyWithDetails.id}`}>
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Edit on Company
                </Button>
              </Link>
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
                to={`/companies/${companyWithDetails.id}`}
                className="font-medium text-primary hover:underline"
              >
                {companyWithDetails.legal_name}
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
          {!isValid && shareholders.length > 0 && (
            <Alert variant={total > 100 ? 'destructive' : 'default'} className="border-warning bg-warning/10">
              <AlertCircle className="h-4 w-4 text-warning" />
              <AlertDescription className="text-warning">
                Company ownership is {formatPercent(total)} — must equal 100%
              </AlertDescription>
            </Alert>
          )}
          {isValid && shareholders.length > 0 && (
            <Alert className="border-success bg-success/10">
              <Check className="h-4 w-4 text-success" />
              <AlertDescription className="text-success">
                Beneficial ownership fully allocated
              </AlertDescription>
            </Alert>
          )}

          {shareholders.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-muted rounded-lg text-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-3">
                No shareholders recorded for {companyWithDetails.legal_name}
              </p>
              <Link to={`/companies/${companyWithDetails.id}`}>
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Add Shareholders on Company Page
                </Button>
              </Link>
            </div>
          ) : (
            <ShareholdersList shareholders={shareholders} />
          )}
        </CardContent>
      </Card>
    );
  }

  // MODE 2: Owned by a single person (show as 100% owner, but also check for direct property ownership records)
  // If there are direct owners in ownership_links, show those instead
  if (hasSinglePersonOwner && !hasDirectOwners) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Beneficial Ownership Split
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
            <User className="h-4 w-4" />
            <span>Directly owned by an individual</span>
          </div>
          
          <Alert className="border-success bg-success/10">
            <Check className="h-4 w-4 text-success" />
            <AlertDescription className="text-success">
              Beneficial ownership fully allocated
            </AlertDescription>
          </Alert>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-md bg-background">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <span className="font-medium">{party.display_name}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-xs">Individual</Badge>
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold">100%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // MODE 3: Direct beneficial ownership on property (multiple individuals)
  // This happens when directOwners exist OR when no legal owner is set
  const activeLinks = directOwners || [];
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
              onClick={() => refetchDirectOwners()}
              className="h-7 text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddOwner}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Owner
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Source indicator */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
          <User className="h-4 w-4" />
          <span>Direct beneficial ownership (multiple individuals)</span>
        </div>

        {/* Progress bar */}
        {activeLinks.length > 0 && (
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
        )}

        {/* Status Alert */}
        {!isValid && activeLinks.length > 0 && (
          <Alert variant={total > 100 ? 'destructive' : 'default'} className="border-warning bg-warning/10">
            <AlertCircle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-warning">
              Ownership is {formatPercent(total)} — must equal 100%
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
              No beneficial owners recorded
            </p>
            <Button variant="outline" size="sm" onClick={handleAddOwner}>
              <Plus className="h-4 w-4 mr-2" />
              Add Beneficial Owner
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {activeLinks.map((link) => {
              const isCompany = link.owner_party?.party_type === 'COMPANY';
              return (
                <div
                  key={link.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 group"
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
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{formatPercent(Number(link.percent))}</span>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleEditOwner(link)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteOwner(link)}
                        disabled={deleteOwnership.isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Editor Dialog */}
      <UnifiedOwnershipEditor
        subjectType="PROPERTY"
        subjectId={propertyId}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        editingLink={editingLink}
      />
    </Card>
  );
}

// Helper component for displaying shareholders list (read-only, from company shareholdings)
function ShareholdersList({ shareholders }: { shareholders: ShareholderDisplay[] }) {
  return (
    <div className="space-y-2">
      {shareholders.map((sh) => {
        const isCompany = sh.partyType === 'COMPANY';
        return (
          <div
            key={sh.id}
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
                <span className="font-medium">{sh.name}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-xs">
                    {isCompany ? 'Company' : 'Individual'}
                  </Badge>
                  {sh.source && (
                    <Badge variant="secondary" className="text-xs capitalize">
                      {sh.source.toLowerCase().replace('_', ' ')}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold">{formatPercent(sh.percent)}</span>
              <p className="text-xs text-muted-foreground">
                {sh.shares.toLocaleString()} shares
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
