import type { CrossCheckRule, WizardPayload, ComplianceItem } from './types';

export const PROPERTY_CROSS_CHECKS: CrossCheckRule[] = [
  {
    id: 'mortgage_fields_complete',
    check: (d) => d.has_mortgage === true && (!d.lender_name || !d.original_amount || !d.interest_rate),
    message: 'Mortgage exists but lender, amount, or rate is missing',
    priority: 'P0',
  },
  {
    id: 'hmo_room_count',
    check: (d) =>
      ['hmo_licensed', 'hmo_mandatory'].includes(d.property_type as string) &&
      ((d.rooms as unknown[])?.length || 0) < 1,
    message: 'HMO property must have at least 1 room defined',
    priority: 'P0',
  },
  {
    id: 'hmo_5_plus_rooms',
    check: (d) =>
      d.property_type === 'hmo_licensed' && (d.total_lettable_rooms as number) < 5,
    message: 'Mandatory HMO licensing typically requires 5+ persons. Confirm room count.',
    priority: 'P1',
  },
  {
    id: 'gas_safety_required',
    check: (d) => {
      if (d.has_gas_supply !== true) return false;
      const items = d.compliance_items as ComplianceItem[] | undefined;
      const gasSafety = items?.find((c) => c.document_type === 'gas_safety_certificate');
      return gasSafety?.is_required === false && !gasSafety?.override_reason;
    },
    message: 'Gas Safety Certificate is legally required for properties with gas supply',
    priority: 'P0',
  },
  {
    id: 'high_ltv',
    check: (d) => {
      if (!d.current_valuation || !d.current_balance) return false;
      return ((d.current_balance as number) / (d.current_valuation as number)) > 0.80;
    },
    message: 'LTV exceeds 80% — check lender covenant requirements',
    priority: 'P1',
  },
  {
    id: 'rate_expiry_soon',
    check: (d) => {
      if (!d.rate_expiry_date) return false;
      const days = (new Date(d.rate_expiry_date as string).getTime() - Date.now()) / 86400000;
      return days < 90 && days > 0;
    },
    message: 'Mortgage fixed rate expires within 90 days — consider refinance options',
    priority: 'P1',
  },
  {
    id: 'compliance_no_expiry',
    check: (d) => {
      const items = d.compliance_items as ComplianceItem[] | undefined;
      return items?.some(
        (c) => c.is_required && c.review_frequency_months && !c.expiry_date
      ) ?? false;
    },
    message: 'Required recurring compliance items should have a next due date to enable reminders',
    priority: 'P1',
  },
];

export function runCrossChecks(data: WizardPayload, rules: CrossCheckRule[] = PROPERTY_CROSS_CHECKS) {
  return rules.filter((rule) => {
    try {
      return rule.check(data);
    } catch {
      return false;
    }
  });
}
