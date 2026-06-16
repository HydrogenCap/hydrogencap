/**
 * Core financial calculations: LTV, equity, costs, yields, cashflow, ROCE.
 */

export function calculateLTV(
  mortgageBalance: number | null | undefined,
  currentValue: number | null | undefined
): number | null {
  if (!mortgageBalance || !currentValue || currentValue === 0) return null;
  return (mortgageBalance / currentValue) * 100;
}

export function calculateEquity(
  currentValue: number | null | undefined,
  mortgageBalance: number | null | undefined
): number | null {
  if (currentValue == null) return null;
  return currentValue - (mortgageBalance || 0);
}

export function calculateTotalCosts(costs: {
  management_gbp?: number | null;
  bills_gbp?: number | null;
  insurance_gbp?: number | null;
  maintenance_gbp?: number | null;
  repairs_gbp?: number | null;
  compliance_gbp?: number | null;
  other_gbp?: number | null;
}): number {
  return (
    (costs.management_gbp || 0) +
    (costs.bills_gbp || 0) +
    (costs.insurance_gbp || 0) +
    (costs.maintenance_gbp || costs.repairs_gbp || 0) +
    (costs.compliance_gbp || 0) +
    (costs.other_gbp || 0)
  );
}

export interface CostsData {
  management_gbp_manual?: number | null;
  repairs_gbp_manual?: number | null;
  insurance_gbp_manual?: number | null;
  bills_gbp_manual?: number | null;
  compliance_gbp_manual?: number | null;
  other_gbp_manual?: number | null;

  management_rule_enabled?: boolean | null;
  management_rule_percent_of_rent?: number | null;
  management_gbp_calculated?: number | null;

  repairs_rule_enabled?: boolean | null;
  repairs_rule_percent_of_rent?: number | null;
  repairs_gbp_calculated?: number | null;

  insurance_rule_enabled?: boolean | null;
  insurance_rule_percent_of_value?: number | null;
  insurance_gbp_calculated?: number | null;
}

export interface EffectiveCosts {
  management: number;
  insurance: number;
  repairs: number;
  bills: number;
  compliance: number;
  other: number;
  total: number;

  managementSource: 'auto' | 'manual';
  insuranceSource: 'auto' | 'manual';
  repairsSource: 'auto' | 'manual';
}

export function calculateCostRules(
  grossRent: number | null,
  propertyValue: number | null,
  costs: CostsData
): { management: number | null; insurance: number | null; repairs: number | null } {
  const managementCalc = (costs.management_rule_enabled !== false && grossRent)
    ? grossRent * ((costs.management_rule_percent_of_rent ?? 5) / 100)
    : null;

  const insuranceCalc = (costs.insurance_rule_enabled !== false && propertyValue)
    ? propertyValue * ((costs.insurance_rule_percent_of_value ?? 0.3) / 100)
    : null;

  const repairsCalc = (costs.repairs_rule_enabled !== false && grossRent)
    ? grossRent * ((costs.repairs_rule_percent_of_rent ?? 5) / 100)
    : null;

  return { management: managementCalc, insurance: insuranceCalc, repairs: repairsCalc };
}

export function getEffectiveCosts(
  grossRent: number | null,
  propertyValue: number | null,
  costs: CostsData | null | undefined
): EffectiveCosts {
  const defaultCosts: CostsData = {
    management_rule_enabled: true,
    management_rule_percent_of_rent: 5.0,
    repairs_rule_enabled: true,
    repairs_rule_percent_of_rent: 5.0,
    insurance_rule_enabled: true,
    insurance_rule_percent_of_value: 0.3,
  };

  const effectiveCostsData: CostsData = costs ? {
    ...defaultCosts,
    ...costs,
  } : defaultCosts;

  const calculated = calculateCostRules(grossRent, propertyValue, effectiveCostsData);

  const hasManualManagement = effectiveCostsData.management_gbp_manual !== null &&
    effectiveCostsData.management_gbp_manual !== undefined &&
    effectiveCostsData.management_gbp_manual > 0;
  const management = hasManualManagement
    ? Number(effectiveCostsData.management_gbp_manual)
    : (calculated.management ?? 0);
  const managementSource = hasManualManagement ? 'manual' : 'auto';

  const hasManualInsurance = effectiveCostsData.insurance_gbp_manual !== null &&
    effectiveCostsData.insurance_gbp_manual !== undefined &&
    effectiveCostsData.insurance_gbp_manual > 0;
  const insurance = hasManualInsurance
    ? Number(effectiveCostsData.insurance_gbp_manual)
    : (calculated.insurance ?? 0);
  const insuranceSource = hasManualInsurance ? 'manual' : 'auto';

  const hasManualRepairs = effectiveCostsData.repairs_gbp_manual !== null &&
    effectiveCostsData.repairs_gbp_manual !== undefined &&
    effectiveCostsData.repairs_gbp_manual > 0;
  const repairs = hasManualRepairs
    ? Number(effectiveCostsData.repairs_gbp_manual)
    : (calculated.repairs ?? 0);
  const repairsSource = hasManualRepairs ? 'manual' : 'auto';

  const bills = effectiveCostsData.bills_gbp_manual ? Number(effectiveCostsData.bills_gbp_manual) : 0;
  const compliance = effectiveCostsData.compliance_gbp_manual ? Number(effectiveCostsData.compliance_gbp_manual) : 0;
  const other = effectiveCostsData.other_gbp_manual ? Number(effectiveCostsData.other_gbp_manual) : 0;

  const total = management + insurance + repairs + bills + compliance + other;

  return {
    management,
    insurance,
    repairs,
    bills,
    compliance,
    other,
    total,
    managementSource: managementSource as 'auto' | 'manual',
    insuranceSource: insuranceSource as 'auto' | 'manual',
    repairsSource: repairsSource as 'auto' | 'manual',
  };
}

export function calculateNOI(annualRent: number | null | undefined, totalCosts: number): number | null {
  if (annualRent == null) return null;
  return annualRent - totalCosts;
}

export function calculateNetRent(annualRent: number | null | undefined, totalCosts: number): number | null {
  return calculateNOI(annualRent, totalCosts);
}

export function calculateAnnualCashflowAfterDebt(
  annualRent: number | null,
  totalCosts: number,
  monthlyMortgagePayment: number | null
): number | null {
  if (annualRent === null) return null;
  const noi = annualRent - totalCosts;
  const annualDebtService = (monthlyMortgagePayment || 0) * 12;
  return noi - annualDebtService;
}

export function calculateMonthlyCashflowAfterDebt(
  annualRent: number | null,
  totalCosts: number,
  monthlyMortgagePayment: number | null
): number | null {
  const annualCashflow = calculateAnnualCashflowAfterDebt(annualRent, totalCosts, monthlyMortgagePayment);
  if (annualCashflow === null) return null;
  return annualCashflow / 12;
}

export function calculateMonthlyCashflow(annualNetRent: number | null): number | null {
  if (annualNetRent == null) return null;
  return annualNetRent / 12;
}

export function calculateGrossYield(
  annualRent: number | null | undefined,
  currentValue: number | null | undefined
): number | null {
  if (!annualRent || !currentValue || currentValue === 0) return null;
  return (annualRent / currentValue) * 100;
}

export function calculateYield(
  annualNetRent: number | null | undefined,
  currentValue: number | null | undefined
): number | null {
  if (annualNetRent == null || !currentValue || currentValue === 0) return null;
  return (annualNetRent / currentValue) * 100;
}

export function calculateROCE(
  annualNetRent: number | null | undefined,
  equity: number | null | undefined,
  capitalInvested?: number | null
): number | null {
  const denominator = capitalInvested && capitalInvested > 0 ? capitalInvested : equity;
  if (annualNetRent == null || !denominator || denominator <= 0) return null;
  return (annualNetRent / denominator) * 100;
}

export function calculateCapitalInvested(property: {
  purchase_price_gbp?: number | null;
  stamp_duty_gbp?: number | null;
  refurb_cost_gbp?: number | null;
  legal_fees_gbp?: number | null;
  other_acquisition_costs_gbp?: number | null;
  loans?: Array<{ current_mortgage_balance_gbp?: number | null }>;
}): number | null {
  const pp = property.purchase_price_gbp ? Number(property.purchase_price_gbp) : null;
  if (!pp) return null;

  const mortgage = property.loans?.[0]?.current_mortgage_balance_gbp
    ? Number(property.loans[0].current_mortgage_balance_gbp) : 0;
  const deposit = pp - mortgage;
  const stamp = property.stamp_duty_gbp ? Number(property.stamp_duty_gbp) : 0;
  const refurb = property.refurb_cost_gbp ? Number(property.refurb_cost_gbp) : 0;
  const legal = property.legal_fees_gbp ? Number(property.legal_fees_gbp) : 0;
  const other = property.other_acquisition_costs_gbp ? Number(property.other_acquisition_costs_gbp) : 0;

  return deposit + stamp + refurb + legal + other;
}
