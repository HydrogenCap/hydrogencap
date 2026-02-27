import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, ArrowUp, Users, Building2 } from 'lucide-react';
import { usePropertyOwnershipV2 } from '@/hooks/useOwnershipAttributionV2';
import { useOwnershipData } from '@/hooks/useOwnershipData';

interface Props {
  entityId: string;
  entityName: string;
}

export function EntityOwnershipCard({ entityId, entityName }: Props) {
  const { data: ownership, isLoading } = usePropertyOwnershipV2(entityId);
  const { data: ownershipData } = useOwnershipData();

  // Find entities where THIS entity is a shareholder
  const ownsEntities = useMemo(() => {
    if (!ownershipData) return [];
    const { shareholders, shareClasses, entities } = ownershipData;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    const holdings = shareholders.filter(
      sh => sh.shareholder_entity_id === entityId &&
        sh.effective_date <= dateStr &&
        (sh.effective_to === null || sh.effective_to > dateStr)
    );

    return holdings.map(h => {
      const entity = entities.find(e => e.id === h.entity_id);
      const shareClass = shareClasses.find(sc => sc.id === h.share_class_id);
      const percent = shareClass && shareClass.issued_shares > 0
        ? (h.shares_held / shareClass.issued_shares) * 100
        : h.percentage;
      return {
        entityId: h.entity_id,
        entityName: entity?.entity_name || 'Unknown',
        percent,
        sharesHeld: h.shares_held,
      };
    });
  }, [ownershipData, entityId]);

  if (isLoading) return null;

  const hasContent = (ownership?.directOwners && ownership.directOwners.length > 0) ||
    ownsEntities.length > 0 ||
    (ownership?.effectiveOwners && ownership.effectiveOwners.length > 0);

  if (!hasContent) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Ownership Structure
        </CardTitle>
        <CardDescription>Who owns {entityName}, and what {entityName} owns</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Who owns this entity */}
        {ownership?.directOwners && ownership.directOwners.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
              <ArrowDown className="h-4 w-4" /> Owned by
            </div>
            <div className="space-y-1.5">
              {ownership.directOwners.map(o => (
                <div key={o.shareholderId} className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <div className="flex items-center gap-2">
                    {o.shareholderType === 'entity'
                      ? <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      : <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    }
                    <span className="text-sm font-medium">{o.shareholderName}</span>
                    <Badge variant="secondary" className="text-[10px]">{o.shareClassName}</Badge>
                  </div>
                  <span className="text-sm font-semibold">{o.ownershipPercent.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* What this entity owns */}
        {ownsEntities.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
              <ArrowUp className="h-4 w-4" /> Shareholder of
            </div>
            <div className="space-y-1.5">
              {ownsEntities.map(o => (
                <div key={o.entityId} className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <span className="text-sm font-medium">{o.entityName}</span>
                  <span className="text-sm font-semibold">{o.percent.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Effective look-through */}
        {ownership?.effectiveOwners && ownership.effectiveOwners.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
              Ultimate beneficial owners
            </div>
            <div className="space-y-1.5">
              {ownership.effectiveOwners.map((o, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded bg-primary/5 border border-primary/10">
                  <div>
                    <span className="text-sm font-medium">{o.ultimateOwnerName}</span>
                    <p className="text-[10px] text-muted-foreground">{o.path.join(' → ')}</p>
                  </div>
                  <span className="text-sm font-bold text-primary">{o.effectivePercent.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Group parent ownership */}
        {ownership?.groupOwnership && ownership.groupOwnership.groupEntityId && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {ownership.groupOwnership.groupEntityName} attributable
              </span>
              <Badge variant={ownership.groupOwnership.ownershipPercent > 0 ? 'default' : 'secondary'}>
                {ownership.groupOwnership.ownershipPercent.toFixed(1)}%
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
