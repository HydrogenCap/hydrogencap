import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, User, Building2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { usePortfolioOwnershipV2, type PortfolioOwnerV2 } from '@/hooks/useOwnershipAttributionV2';
import { usePropertiesV2 } from '@/hooks/usePropertiesV2';
import { formatPercent } from '@/lib/calculations';
import { cn } from '@/lib/utils';

function OwnerRow({ owner }: { owner: PortfolioOwnerV2 }) {
  const [isOpen, setIsOpen] = useState(false);

  const minPct = Math.min(...owner.properties.map(p => p.effectivePercent));
  const maxPct = Math.max(...owner.properties.map(p => p.effectivePercent));
  const pctLabel = minPct === maxPct
    ? `${minPct.toFixed(1)}%`
    : `${minPct.toFixed(1)}–${maxPct.toFixed(1)}%`;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className={cn(
          "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
          isOpen ? "bg-primary/10" : "bg-muted/50 hover:bg-muted"
        )}>
          <div className="p-2 rounded-lg bg-background">
            {owner.ownerType === 'individual'
              ? <User className="h-4 w-4" />
              : <Building2 className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{owner.ownerName}</div>
            <div className="text-xs text-muted-foreground">
              {owner.totalEffectiveProperties} properties · {pctLabel} effective
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 ml-1">
            {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-2 ml-4 space-y-1">
          {owner.properties.slice(0, 5).map((prop) => (
            <Link
              key={prop.propertyId}
              to={`/properties/${prop.propertyId}`}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{prop.propertyAddress}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">
                  {formatPercent(prop.effectivePercent, 1)}
                </span>
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
      </CollapsibleContent>
    </Collapsible>
  );
}

export function BeneficialOwnerWidget() {
  const { data: properties } = usePropertiesV2();
  const coreProperties = (properties || [])
    .filter(p => ['stabilised', 'letting'].includes(p.lifecycle_stage))
    .map(p => ({
      id: p.id,
      address_line_1: p.address_line_1,
      city: p.city,
      entity_id: p.entity_id,
    }));

  const { data: ownershipV2, isLoading } = usePortfolioOwnershipV2(
    coreProperties.length > 0 ? coreProperties : undefined
  );

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

  const owners = ownershipV2?.portfolioOwners || [];

  if (owners.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Beneficial Owners
          </CardTitle>
          <CardDescription>Ownership attribution by beneficial owner</CardDescription>
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
          {owners.length} owners across {coreProperties.length} properties
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {owners.slice(0, 6).map((owner) => (
          <OwnerRow key={owner.ownerEntityId || owner.ownerName} owner={owner} />
        ))}
        {owners.length > 6 && (
          <Link
            to="/insights"
            className="block text-center text-sm text-primary hover:underline py-2"
          >
            +{owners.length - 6} more owners →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
