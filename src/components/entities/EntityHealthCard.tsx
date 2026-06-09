import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, CircleAlert, FileWarning, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { LegalEntity, EntityDirector, EntityShareholder } from '@/hooks/useLegalEntities';
import type { ShareClassWithAllocation } from '@/hooks/useShareCapital';
import type { EntityVerification } from '@/hooks/useCompaniesHouseV2';
import type { PropertyV2 } from '@/hooks/usePropertiesV2';
import { useAllLoanFacilities } from '@/hooks/useLoanFacilities';
import { computeEntityHealth, HEALTH_LABEL } from '@/lib/entityHealth';

interface ShareIntegrityError {
  classId: string;
  className: string;
  issued: number;
  allocated: number;
  error: string;
}

interface EntityHealthCardProps {
  entity: LegalEntity;
  directors?: EntityDirector[];
  shareholders?: EntityShareholder[];
  shareClassesWithAllocation?: ShareClassWithAllocation[];
  integrityErrors?: ShareIntegrityError[];
  verification?: EntityVerification | null;
  entityProperties?: PropertyV2[];
}

const LEVEL_BADGE = {
  red: { variant: 'destructive' as const, icon: CircleAlert, dotClass: 'bg-destructive' },
  amber: { variant: 'secondary' as const, icon: AlertTriangle, dotClass: 'bg-amber-500' },
  green: { variant: 'secondary' as const, icon: CheckCircle2, dotClass: 'bg-emerald-500' },
};

export function EntityHealthCard({
  entity,
  shareholders,
  integrityErrors = [],
  verification,
  entityProperties,
}: EntityHealthCardProps) {
  const navigate = useNavigate();
  const { data: loans } = useAllLoanFacilities();

  // Build property->loan map for owned properties only
  const loansByProperty = new Map<string, { hasActiveLoan: boolean }>();
  (loans || []).forEach(l => {
    if (['active', 'drawdown', 'pending_drawdown'].includes(l.status)) {
      loansByProperty.set(l.property_id, { hasActiveLoan: true });
    }
  });

  const health = computeEntityHealth({
    entity,
    verification: verification ?? null,
    shareholders,
    entityProperties,
    loansByProperty,
  });

  // Merge in any share-class integrity errors as red issues.
  const integrityIssues = integrityErrors.map(err => ({
    id: `integrity-${err.classId}`,
    label: 'Share-capital integrity issue',
    detail: err.error,
    severity: 'red' as const,
    fixLabel: 'Fix share class',
    fixUrl: `/entities/${entity.id}?tab=overview`,
  }));

  const allIssues = [...integrityIssues, ...health.issues];
  const level = integrityIssues.length > 0 ? 'red' : health.level;
  const badgeCfg = LEVEL_BADGE[level];
  const Icon = badgeCfg.icon;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <FileWarning className="h-5 w-5" />
          Entity Health
        </CardTitle>
        <Badge variant={badgeCfg.variant} className="gap-1.5">
          <span className={`inline-block h-2 w-2 rounded-full ${badgeCfg.dotClass}`} />
          {HEALTH_LABEL[level]}
          {allIssues.length > 0 && ` · ${allIssues.length}`}
        </Badge>
      </CardHeader>
      <CardContent>
        {allIssues.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            All entity checks pass.
          </div>
        ) : (
          <ul className="space-y-2">
            {allIssues.map(issue => (
              <li
                key={issue.id}
                className="flex items-start justify-between gap-3 rounded-md border border-border p-3"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <Icon
                    className={`h-4 w-4 mt-0.5 shrink-0 ${
                      issue.severity === 'red' ? 'text-destructive' : 'text-amber-500'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{issue.label}</p>
                    <p className="text-xs text-muted-foreground break-words">{issue.detail}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1"
                  onClick={() => navigate(issue.fixUrl)}
                >
                  {issue.fixLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
