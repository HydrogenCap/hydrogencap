/**
 * Entity health — single source of truth.
 *
 * Computes a Red/Amber/Green status for a legal entity from:
 *  - Missing company number (SPV/Ltd)
 *  - Overdue Companies House accounts
 *  - Overdue confirmation statement
 *  - Unresolved Companies House mismatch
 *  - Missing/incorrect ownership percentages
 *  - Properties missing valuation or loan data
 *
 * Each issue carries a `fixUrl` so the UI can render a one-click path.
 */
import type { LegalEntity, EntityShareholder } from '@/hooks/useLegalEntities';
import type { EntityVerification } from '@/hooks/useCompaniesHouseV2';
import type { PropertyV2 } from '@/hooks/usePropertiesV2';

export type EntityHealthLevel = 'red' | 'amber' | 'green';

export interface EntityHealthIssue {
  id: string;
  label: string;
  detail: string;
  severity: 'red' | 'amber';
  fixLabel: string;
  fixUrl: string;
}

export interface EntityHealth {
  level: EntityHealthLevel;
  issues: EntityHealthIssue[];
  redCount: number;
  amberCount: number;
}

export interface EntityHealthInputs {
  entity: Pick<
    LegalEntity,
    | 'id'
    | 'entity_type'
    | 'company_number'
    | 'accounts_due_date'
    | 'confirmation_statement_due_date'
  >;
  verification?: EntityVerification | null;
  shareholders?: EntityShareholder[];
  /** Properties owned by this entity (entity_id matches) */
  entityProperties?: Pick<PropertyV2, 'id' | 'address_line_1' | 'current_valuation'>[];
  /** Loan facilities (current_balance, status) keyed by property_id */
  loansByProperty?: Map<string, { hasActiveLoan: boolean }>;
}

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return null;
  const today = Date.now();
  return Math.round((target - today) / 86_400_000);
}

export function computeEntityHealth({
  entity,
  verification,
  shareholders,
  entityProperties,
  loansByProperty,
}: EntityHealthInputs): EntityHealth {
  const issues: EntityHealthIssue[] = [];
  const entityUrl = `/entities/${entity.id}`;
  const isSpv = entity.entity_type === 'spv';

  // 1) Missing company number (SPV only)
  if (isSpv && !entity.company_number) {
    issues.push({
      id: 'no-company-number',
      label: 'Company number missing',
      detail: 'Add a Companies House registration number so filings can be tracked.',
      severity: 'red',
      fixLabel: 'Add company number',
      fixUrl: entityUrl,
    });
  }

  // 2) Accounts overdue / due soon
  const accountsDue = daysUntil(entity.accounts_due_date ?? null);
  if (isSpv && accountsDue !== null) {
    if (accountsDue < 0) {
      issues.push({
        id: 'accounts-overdue',
        label: 'Annual accounts overdue',
        detail: `Filing deadline was ${Math.abs(accountsDue)} day${Math.abs(accountsDue) === 1 ? '' : 's'} ago.`,
        severity: 'red',
        fixLabel: 'View filings',
        fixUrl: `${entityUrl}?tab=filings`,
      });
    } else if (accountsDue <= 30) {
      issues.push({
        id: 'accounts-soon',
        label: 'Annual accounts due soon',
        detail: `${accountsDue} day${accountsDue === 1 ? '' : 's'} left to file.`,
        severity: 'amber',
        fixLabel: 'View filings',
        fixUrl: `${entityUrl}?tab=filings`,
      });
    }
  }

  // 3) Confirmation statement overdue / due soon
  const confDue = daysUntil(entity.confirmation_statement_due_date ?? null);
  if (isSpv && confDue !== null) {
    if (confDue < 0) {
      issues.push({
        id: 'confirmation-overdue',
        label: 'Confirmation statement overdue',
        detail: `Filing deadline was ${Math.abs(confDue)} day${Math.abs(confDue) === 1 ? '' : 's'} ago.`,
        severity: 'red',
        fixLabel: 'View filings',
        fixUrl: `${entityUrl}?tab=filings`,
      });
    } else if (confDue <= 30) {
      issues.push({
        id: 'confirmation-soon',
        label: 'Confirmation statement due soon',
        detail: `${confDue} day${confDue === 1 ? '' : 's'} left to file.`,
        severity: 'amber',
        fixLabel: 'View filings',
        fixUrl: `${entityUrl}?tab=filings`,
      });
    }
  }

  // 4) Companies House mismatch
  if (isSpv && entity.company_number && verification?.verification_status === 'status_mismatch') {
    issues.push({
      id: 'ch-mismatch',
      label: 'Companies House mismatch',
      detail: 'Local status differs from the Companies House record.',
      severity: 'red',
      fixLabel: 'Review & resolve',
      fixUrl: `${entityUrl}?tab=overview`,
    });
  }

  // 5) Ownership percentages
  if (isSpv) {
    if (!shareholders || shareholders.length === 0) {
      issues.push({
        id: 'no-shareholders',
        label: 'No shareholders recorded',
        detail: 'Add the shareholders that own this entity.',
        severity: 'red',
        fixLabel: 'Add shareholder',
        fixUrl: `${entityUrl}?tab=overview`,
      });
    } else {
      const totalPct = shareholders.reduce(
        (sum, s) => sum + (Number(s.percentage) || 0),
        0,
      );
      if (Math.abs(totalPct - 100) > 0.1) {
        issues.push({
          id: 'ownership-mismatch',
          label: 'Ownership doesn\u2019t total 100%',
          detail: `Shareholders currently total ${totalPct.toFixed(1)}%.`,
          severity: 'red',
          fixLabel: 'Fix ownership',
          fixUrl: `${entityUrl}?tab=overview`,
        });
      }
    }
  }

  // 6) Properties missing valuation
  const props = entityProperties || [];
  const missingValuation = props.filter(p => !p.current_valuation);
  if (missingValuation.length > 0) {
    issues.push({
      id: 'missing-valuation',
      label: `Missing valuation on ${missingValuation.length} propert${missingValuation.length === 1 ? 'y' : 'ies'}`,
      detail: missingValuation
        .slice(0, 3)
        .map(p => p.address_line_1)
        .join(', ') + (missingValuation.length > 3 ? '…' : ''),
      severity: 'amber',
      fixLabel: 'Add valuation',
      fixUrl: `/properties-v2/${missingValuation[0].id}?tab=financials`,
    });
  }

  // 7) Properties with no loan record (could indicate missing loan data, not unencumbered).
  // Only flag if entity has properties and no loan facility on file at all.
  if (props.length > 0 && loansByProperty && loansByProperty.size > 0) {
    const missingLoan = props.filter(p => !loansByProperty.get(p.id)?.hasActiveLoan);
    // Treat as amber only if some properties have loans (mixed) — i.e. likely data gap.
    if (missingLoan.length > 0 && missingLoan.length < props.length) {
      issues.push({
        id: 'missing-loan',
        label: `Missing loan data on ${missingLoan.length} propert${missingLoan.length === 1 ? 'y' : 'ies'}`,
        detail: missingLoan
          .slice(0, 3)
          .map(p => p.address_line_1)
          .join(', ') + (missingLoan.length > 3 ? '…' : ''),
        severity: 'amber',
        fixLabel: 'Add loan',
        fixUrl: `/lending`,
      });
    }
  }

  const redCount = issues.filter(i => i.severity === 'red').length;
  const amberCount = issues.filter(i => i.severity === 'amber').length;
  const level: EntityHealthLevel = redCount > 0 ? 'red' : amberCount > 0 ? 'amber' : 'green';

  return { level, issues, redCount, amberCount };
}

export const HEALTH_LABEL: Record<EntityHealthLevel, string> = {
  red: 'Action needed',
  amber: 'Review',
  green: 'Healthy',
};
