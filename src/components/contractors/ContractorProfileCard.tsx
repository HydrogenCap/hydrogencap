import React from 'react';
import {
  Star,
  Phone,
  Mail,
  Clock,
  CheckCircle,
  Shield,
  Flame,
  Zap,
  MapPin,
  PoundSterling,
  FileText,
  Briefcase,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { type Contractor } from '@/hooks/useContractors';
import { cn } from '@/lib/utils';

interface RateCard {
  callout?: number;
  hourly?: number;
  daily?: number;
}

interface ContractorProfileCardProps {
  contractor: Contractor & {
    trades?: string[];
    coverage_areas?: string[];
    insurance_expiry?: string | null;
    gas_safe_number?: string | null;
    niceic_number?: string | null;
    avg_rating?: number;
    total_jobs_completed?: number;
    preferred?: boolean;
    rate_card?: RateCard;
  };
  onTogglePreferred?: (contractorId: string, preferred: boolean) => void;
  onRequestQuote?: (contractorId: string) => void;
  onAssignJob?: (contractorId: string) => void;
  onClick?: () => void;
}

function getInsuranceStatus(expiryDate: string | null | undefined): {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
} {
  if (!expiryDate) return { label: 'No insurance info', variant: 'outline' };
  const expiry = new Date(expiryDate);
  const now = new Date();
  const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry < 0) return { label: 'Insurance expired', variant: 'destructive' };
  if (daysUntilExpiry < 30) return { label: `Insurance expires in ${daysUntilExpiry}d`, variant: 'destructive' };
  if (daysUntilExpiry < 90) return { label: `Insurance expires in ${daysUntilExpiry}d`, variant: 'secondary' };
  return { label: 'Insurance valid', variant: 'default' };
}

export function ContractorProfileCard({
  contractor,
  onTogglePreferred,
  onRequestQuote,
  onAssignJob,
  onClick,
}: ContractorProfileCardProps) {
  const insuranceStatus = getInsuranceStatus(contractor.insurance_expiry);
  const trades = contractor.trades || contractor.compliance_types || [];
  const coverageAreas = contractor.coverage_areas || contractor.service_areas || [];
  const avgRating = contractor.avg_rating ?? contractor.average_rating ?? 0;
  const totalJobs = contractor.total_jobs_completed ?? contractor.total_jobs ?? 0;
  const isPreferred = contractor.preferred ?? contractor.is_preferred ?? false;
  const rateCard = contractor.rate_card || {} as RateCard;

  return (
    <Card
      className={cn(
        "transition-shadow duration-150 hover:shadow-md motion-reduce:transition-none",
        onClick && "cursor-pointer",
        isPreferred && "ring-1 ring-amber-300 dark:ring-amber-600"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg shrink-0">
              {contractor.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base">{contractor.name}</h3>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePreferred?.(contractor.id, !isPreferred);
                        }}
                        className="focus:outline-none"
                      >
                        <Star
                          className={cn(
                            'h-4 w-4 transition-colors',
                            isPreferred
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-muted-foreground hover:text-amber-400'
                          )}
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isPreferred ? 'Remove from preferred' : 'Mark as preferred'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              {contractor.company_name && (
                <p className="text-sm text-muted-foreground">{contractor.company_name}</p>
              )}
            </div>
          </div>

          {/* Rating badge */}
          {avgRating > 0 && (
            <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="text-sm font-semibold">{avgRating.toFixed(1)}</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {/* Trades */}
        {trades.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {trades.slice(0, 4).map((trade) => (
              <Badge key={trade} variant="secondary" className="text-xs">
                {trade}
              </Badge>
            ))}
            {trades.length > 4 && (
              <Badge variant="outline" className="text-xs">
                +{trades.length - 4}
              </Badge>
            )}
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {totalJobs > 0 && (
            <div className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              {totalJobs} jobs
            </div>
          )}
          {contractor.avg_response_hours != null && contractor.avg_response_hours > 0 && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {contractor.avg_response_hours < 1
                ? `${Math.round(contractor.avg_response_hours * 60)}m avg`
                : `${contractor.avg_response_hours.toFixed(0)}h avg`}
            </div>
          )}
        </div>

        {/* Coverage areas */}
        {coverageAreas.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{coverageAreas.slice(0, 3).join(', ')}</span>
            {coverageAreas.length > 3 && <span>+{coverageAreas.length - 3}</span>}
          </div>
        )}

        {/* Certifications & Insurance */}
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={insuranceStatus.variant} className="text-xs">
            <Shield className="h-3 w-3 mr-1" />
            {insuranceStatus.label}
          </Badge>
          {contractor.gas_safe_number && (
            <Badge variant="outline" className="text-xs">
              <Flame className="h-3 w-3 mr-1" />
              Gas Safe
            </Badge>
          )}
          {contractor.niceic_number && (
            <Badge variant="outline" className="text-xs">
              <Zap className="h-3 w-3 mr-1" />
              NICEIC
            </Badge>
          )}
        </div>

        {/* Rate card */}
        {(rateCard.callout || rateCard.hourly || rateCard.daily) && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground border-t pt-2">
            <PoundSterling className="h-3 w-3 shrink-0" />
            {rateCard.callout && <span>Callout: £{rateCard.callout}</span>}
            {rateCard.hourly && <span>Hourly: £{rateCard.hourly}</span>}
            {rateCard.daily && <span>Daily: £{rateCard.daily}</span>}
          </div>
        )}

        {/* Contact & Actions */}
        <div className="flex items-center gap-2 border-t pt-3">
          {contractor.phone && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`tel:${contractor.phone}`);
                    }}
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{contractor.phone}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {contractor.email && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`mailto:${contractor.email}`);
                    }}
                  >
                    <Mail className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{contractor.email}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <div className="ml-auto flex items-center gap-2">
            {onRequestQuote && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestQuote(contractor.id);
                }}
              >
                <FileText className="h-3.5 w-3.5 mr-1" />
                Request Quote
              </Button>
            )}
            {onAssignJob && (
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onAssignJob(contractor.id);
                }}
              >
                <Briefcase className="h-3.5 w-3.5 mr-1" />
                Assign Job
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
