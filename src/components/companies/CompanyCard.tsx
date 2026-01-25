import React from 'react';
import { Building2, Users, Calendar, MapPin, ExternalLink, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCompany, type CompanyWithDetails } from '@/hooks/useCompanies';
import { formatPercent } from '@/lib/calculations';
import { cn } from '@/lib/utils';

interface CompanyCardProps {
  companyId: string;
  onViewDetails?: () => void;
  onRefreshFromCH?: () => void;
  isRefreshing?: boolean;
}

const companyTypeLabels: Record<string, string> = {
  HOLDCO: 'Holding Co',
  SPV: 'SPV',
  OPCO: 'Operating Co',
  OTHER: 'Other',
};

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  DORMANT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  SOLD: 'bg-muted text-muted-foreground',
  CLOSED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export function CompanyCard({ companyId, onViewDetails, onRefreshFromCH, isRefreshing }: CompanyCardProps) {
  const { data: company, isLoading } = useCompany(companyId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-40" />
        </CardContent>
      </Card>
    );
  }

  if (!company) return null;

  // Calculate total ownership per share class
  const shareClassSummaries = company.share_classes.map((sc) => {
    const holdings = company.shareholdings.filter((sh) => sh.share_class_id === sc.id);
    const totalHeld = holdings.reduce((sum, h) => sum + h.shares_held, 0);
    const percentAllocated = (totalHeld / sc.issued_shares) * 100;

    return {
      shareClass: sc,
      totalHeld,
      percentAllocated,
      holders: holdings,
    };
  });

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-primary" />
              {company.legal_name}
            </CardTitle>
            {company.trading_name && company.trading_name !== company.legal_name && (
              <p className="text-sm text-muted-foreground">
                Trading as: {company.trading_name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{companyTypeLabels[company.company_type]}</Badge>
            <Badge className={cn('text-xs', statusColors[company.status])}>
              {company.status}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Company Details */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {company.company_number && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="font-medium">Company No:</span>
              <a
                href={`https://find-and-update.company-information.service.gov.uk/company/${company.company_number}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
              >
                {company.company_number}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
          {company.ch_incorporation_date && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Inc. {new Date(company.ch_incorporation_date).toLocaleDateString()}</span>
            </div>
          )}
          {company.ch_registered_address && (
            <div className="flex items-start gap-2 text-muted-foreground col-span-2">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
              <span className="text-xs">{company.ch_registered_address}</span>
            </div>
          )}
        </div>

        {/* Shareholdings */}
        {shareClassSummaries.map(({ shareClass, percentAllocated, holders }) => (
          <div key={shareClass.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                {shareClass.name} Shares
              </h4>
              <span className="text-xs text-muted-foreground">
                {shareClass.issued_shares.toLocaleString()} issued
              </span>
            </div>

            {holders.length === 0 ? (
              <p className="text-xs text-muted-foreground py-1">No shareholders recorded</p>
            ) : (
              <div className="space-y-1">
                {holders.map((holding) => {
                  const percent = (holding.shares_held / shareClass.issued_shares) * 100;
                  return (
                    <div
                      key={holding.id}
                      className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{holding.shareholder_party?.display_name}</span>
                        {holding.ownership_source === 'COMPANIES_HOUSE' && (
                          <Badge variant="outline" className="text-xs">CH</Badge>
                        )}
                      </div>
                      <Badge variant="secondary" className="font-mono">
                        {formatPercent(percent)}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}

            {percentAllocated < 100 && (
              <p className="text-xs text-warning">
                {formatPercent(100 - percentAllocated)} unallocated
              </p>
            )}
          </div>
        ))}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          {onViewDetails && (
            <Button variant="outline" size="sm" onClick={onViewDetails}>
              View Details
            </Button>
          )}
          {onRefreshFromCH && company.company_number && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefreshFromCH}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn('h-4 w-4 mr-1', isRefreshing && 'animate-spin')} />
              Sync from CH
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
