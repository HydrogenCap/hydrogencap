import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, User, Building2, ChevronDown, ChevronUp, ExternalLink, TrendingUp, Wallet, PiggyBank } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { usePortfolioAttribution, type OwnerAttribution } from '@/hooks/useOwnershipAttribution';
import { PropertyWithFinancials } from '@/hooks/useProperties';
import { formatGBP, formatPercent } from '@/lib/calculations';
import { cn } from '@/lib/utils';

interface BeneficialOwnerWidgetProps {
  properties: PropertyWithFinancials[];
}

const ownerTypeIcons: Record<string, React.ReactNode> = {
  INDIVIDUAL: <User className="h-4 w-4" />,
  COMPANY: <Building2 className="h-4 w-4" />,
  TRUST: <Users className="h-4 w-4" />,
  SPV: <Building2 className="h-4 w-4" />,
  Person: <User className="h-4 w-4" />,
};

function OwnerRow({ owner, totalEquity }: { owner: OwnerAttribution; totalEquity: number }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const equityShare = totalEquity > 0
    ? (owner.totals.totalAttributableEquity / totalEquity) * 100
    : 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className={cn(
          "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
          isOpen ? "bg-primary/10" : "bg-muted/50 hover:bg-muted"
        )}>
          <div className="p-2 rounded-lg bg-background">
            {ownerTypeIcons[owner.ownerType] || <User className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{owner.ownerName}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{owner.totals.propertyCount} properties</span>
              <span>•</span>
              <span className="font-medium text-primary">{formatPercent(equityShare, 1)} equity</span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-semibold text-sm">{formatGBP(owner.totals.totalAttributableEquity)}</div>
            <div className={cn(
              "text-xs",
              owner.totals.totalAttributableCashflow >= 0 ? "text-success" : "text-destructive"
            )}>
              {formatGBP(owner.totals.totalAttributableCashflow)}/yr
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 ml-1">
            {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="mt-2 ml-4 space-y-2">
          {/* Summary metrics */}
          <div className="grid grid-cols-3 gap-2 p-2 rounded-lg bg-muted/30 text-xs">
            <div>
              <span className="text-muted-foreground">Value:</span>
              <span className="ml-1 font-medium">{formatGBP(owner.totals.totalAttributableValue)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Debt:</span>
              <span className="ml-1 font-medium">{formatGBP(owner.totals.totalAttributableDebt)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">NOI:</span>
              <span className={cn(
                "ml-1 font-medium",
                owner.totals.totalAttributableNOI >= 0 ? "text-success" : "text-destructive"
              )}>
                {formatGBP(owner.totals.totalAttributableNOI)}
              </span>
            </div>
          </div>
          
          {/* Property breakdown */}
          <div className="space-y-1">
            {owner.properties.slice(0, 5).map((prop) => (
              <Link
                key={prop.propertyId}
                to={`/properties/${prop.propertyId}`}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{prop.propertyAddress}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatPercent(prop.effectivePercent, 1)} stake
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right text-xs">
                    <div>{formatGBP(prop.attributableEquity)}</div>
                    <div className={cn(
                      prop.attributableCashflow >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {formatGBP(prop.attributableCashflow)}/yr
                    </div>
                  </div>
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ))}
            {owner.properties.length > 5 && (
              <Link
                to="/insights"
                className="block text-center text-xs text-primary hover:underline py-1"
              >
                +{owner.properties.length - 5} more properties →
              </Link>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function BeneficialOwnerWidget({ properties }: BeneficialOwnerWidgetProps) {
  const { data: attribution, isLoading } = usePortfolioAttribution(properties);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Beneficial Owners
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  if (!attribution || attribution.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Beneficial Owners
          </CardTitle>
          <CardDescription>
            Financial attribution by owner
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No ownership data available</p>
            <p className="text-xs mt-1">Set up company shareholders to see attribution</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate total equity for percentage display
  const totalEquity = attribution.reduce(
    (sum, owner) => sum + owner.totals.totalAttributableEquity,
    0
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Beneficial Owners
          </CardTitle>
          <Link to="/insights">
            <Button variant="ghost" size="sm" className="text-xs">
              View All <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
        <CardDescription>
          {attribution.length} owners across {properties.length} properties
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {attribution.slice(0, 6).map((owner) => (
          <OwnerRow key={owner.ownerId} owner={owner} totalEquity={totalEquity} />
        ))}
        {attribution.length > 6 && (
          <Link
            to="/insights"
            className="block text-center text-sm text-primary hover:underline py-2"
          >
            +{attribution.length - 6} more owners →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
