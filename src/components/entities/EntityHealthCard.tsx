import type { ComponentType } from 'react';
import { AlertTriangle, CheckCircle2, CircleAlert, CircleDashed, FileWarning } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { LegalEntity, EntityDirector, EntityShareholder } from '@/hooks/useLegalEntities';
import type { ShareClassWithAllocation } from '@/hooks/useShareCapital';
import type { EntityVerification } from '@/hooks/useCompaniesHouseV2';
import type { PropertyV2 } from '@/hooks/usePropertiesV2';

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

type HealthLevel = 'good' | 'watch' | 'critical' | 'incomplete';

interface HealthItem {
  label: string;
  detail: string;
  level: HealthLevel;
}

const LEVEL_CONFIG: Record<HealthLevel, { icon: ComponentType<{ className?: string }>; badge: string; className: string }> = {
  good: { icon: CheckCircle2, badge: 'Good', className: 'text-emerald-600 dark:text-emerald-400' },
  watch: { icon: AlertTriangle, badge: 'Watch', className: 'text-amber-600 dark:text-amber-400' },
  critical: { icon: CircleAlert, badge: 'Critical', className: 'text-red-600 dark:text-red-400' },
  incomplete: { icon: CircleDashed, badge: 'Incomplete', className: 'text-muted-foreground' },
};

export function EntityHealthCard({
  entity,
  directors,
  shareholders,
  shareClassesWithAllocation,
  integrityErrors = [],
  verification,
  entityProperties,
}: EntityHealthCardProps) {
  const activeDirectors = directors?.filter((director) => director.is_current) || [];
  const hasShareCapital = entity.entity_type === 'spv';
  const hasProperties = (entityProperties?.length || 0) > 0;
  const propertiesMissingValue = (entityProperties || []).filter((property) => !property.current_valuation).length;
  const propertiesMissingRent = (entityProperties || []).filter((property) => {
    if (property.rent_basis === 'whole_house') return !property.whole_house_rent_pcm;
    return !property.total_lettable_rooms;
  }).length;

  const items: HealthItem[] = [
    getCompanyHouseHealth(entity, verification),
    {
      label: 'Directors',
      detail: activeDirectors.length > 0 ? `${activeDirectors.length} current director${activeDirectors.length === 1 ? '' : 's'}` : 'No current directors recorded',
      level: entity.entity_type === 'spv' && activeDirectors.length === 0 ? 'critical' : activeDirectors.length === 0 ? 'incomplete' : 'good',
    },
    getOwnershipHealth(hasShareCapital, shareholders, shareClassesWithAllocation, integrityErrors),
    {
      label: 'Properties',
      detail: hasProperties ? `${entityProperties!.length} linked propert${entityProperties!.length === 1 ? 'y' : 'ies'}` : 'No properties linked yet',
      level: hasProperties ? 'good' : 'incomplete',
    },
    {
      label: 'Portfolio data',
      detail: getPortfolioDataDetail(propertiesMissingValue, propertiesMissingRent),
      level: propertiesMissingValue > 0 || propertiesMissingRent > 0 ? 'watch' : hasProperties ? 'good' : 'incomplete',
    },
    getFilingHealth(entity),
  ];

  const criticalCount = items.filter((item) => item.level === 'critical').length;
  const watchCount = items.filter((item) => item.level === 'watch').length;
  const incompleteCount = items.filter((item) => item.level === 'incomplete').length;

  const summary = criticalCount > 0
    ? `${criticalCount} critical`
    : watchCount > 0
      ? `${watchCount} to review`
      : incompleteCount > 0
        ? `${incompleteCount} incomplete`
        : 'Healthy';

  const summaryVariant = criticalCount > 0 ? 'destructive' : 'secondary';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <FileWarning className="h-5 w-5" />
          Entity Health
        </CardTitle>
        <Badge variant={summaryVariant}>{summary}</Badge>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((item) => {
            const config = LEVEL_CONFIG[item.level];
            const Icon = config.icon;
            return (
              <div key={item.label} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                  <Icon className={`h-4 w-4 ${config.className}`} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                <p className={`mt-2 text-xs font-medium ${config.className}`}>{config.badge}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function getCompanyHouseHealth(entity: LegalEntity, verification?: EntityVerification | null): HealthItem {
  if (entity.entity_type !== 'spv') {
    return { label: 'Companies House', detail: 'Not required for this entity type', level: 'good' };
  }
  if (!entity.company_number) {
    return { label: 'Companies House', detail: 'Company number is missing', level: 'critical' };
  }
  if (!verification || verification.verification_status === 'not_synced') {
    return { label: 'Companies House', detail: 'Companies House data has not been synced', level: 'watch' };
  }
  if (verification.verification_status === 'status_mismatch') {
    return { label: 'Companies House', detail: 'Local status differs from Companies House', level: 'critical' };
  }
  return { label: 'Companies House', detail: 'Companies House record verified', level: 'good' };
}

function getOwnershipHealth(
  hasShareCapital: boolean,
  shareholders?: EntityShareholder[],
  shareClassesWithAllocation?: ShareClassWithAllocation[],
  integrityErrors: ShareIntegrityError[] = [],
): HealthItem {
  if (!hasShareCapital) {
    return { label: 'Ownership', detail: 'Share capital is not required for this entity type', level: 'good' };
  }
  if (integrityErrors.length > 0) {
    return { label: 'Ownership', detail: integrityErrors[0].error, level: 'critical' };
  }
  if (!shareClassesWithAllocation || shareClassesWithAllocation.length === 0) {
    return { label: 'Ownership', detail: 'No share classes recorded', level: 'critical' };
  }
  if (!shareholders || shareholders.length === 0) {
    return { label: 'Ownership', detail: 'No shareholders recorded', level: 'critical' };
  }
  const totalPct = shareholders.reduce((sum, shareholder) => sum + (shareholder.percentage || 0), 0);
  if (Math.abs(totalPct - 100) > 0.1) {
    return { label: 'Ownership', detail: `Shareholders total ${totalPct.toFixed(1)}%`, level: 'critical' };
  }
  return { label: 'Ownership', detail: 'Shareholders and share classes balance', level: 'good' };
}

function getPortfolioDataDetail(missingValue: number, missingRent: number) {
  const parts = [];
  if (missingValue > 0) parts.push(`${missingValue} missing valuation${missingValue === 1 ? '' : 's'}`);
  if (missingRent > 0) parts.push(`${missingRent} missing rent/room data`);
  return parts.length > 0 ? parts.join(' · ') : 'Key portfolio fields are complete';
}

function getFilingHealth(entity: LegalEntity): HealthItem {
  if (entity.entity_type !== 'spv') {
    return { label: 'Filing dates', detail: 'Not required for this entity type', level: 'good' };
  }
  if (!entity.accounts_due_date || !entity.confirmation_statement_due_date) {
    return { label: 'Filing dates', detail: 'Accounts or confirmation statement date is missing', level: 'watch' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDates = [entity.accounts_due_date, entity.confirmation_statement_due_date].map((date) => new Date(date));
  if (dueDates.some((date) => date < today)) {
    return { label: 'Filing dates', detail: 'A filing deadline is overdue', level: 'critical' };
  }
  const ninetyDays = 90 * 24 * 60 * 60 * 1000;
  if (dueDates.some((date) => date.getTime() - today.getTime() <= ninetyDays)) {
    return { label: 'Filing dates', detail: 'A filing deadline is due within 90 days', level: 'watch' };
  }
  return { label: 'Filing dates', detail: 'Filing deadlines are in good shape', level: 'good' };
}
