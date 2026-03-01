/**
 * UK Property Tax Calculation Engine
 * Calculates SA105 data, Section 24 mortgage interest relief,
 * and annual tax summaries per property and per entity.
 *
 * DISCLAIMER: This is an estimate only. Consult a qualified accountant for tax advice.
 */

// ── Types ──

export interface SA105PropertyData {
  propertyId: string;
  propertyAddress: string;
  entityId: string | null;
  entityName: string | null;
  entityType: string | null; // 'spv' | 'personal' | etc.
  totalRentalIncome: number;
  usePropertyAllowance: boolean;
  repairs: number;
  insurance: number;
  managementFees: number;
  accountingFees: number;
  groundRent: number;
  serviceCharges: number;
  otherAllowableExpenses: number;
  totalAllowableExpenses: number;
  residentialFinanceCosts: number;
  adjustedProfit: number;
  taxCreditAt20Percent: number;
}

export type MarginalTaxRate = 0.20 | 0.40 | 0.45;

export interface Section24Calculation {
  totalMortgageInterest: number;
  taxReliefAt20Percent: number;
  taxSavedVsOldRules: number;
  additionalTaxDueToS24: number;
  effectiveTaxRate: number;
}

export interface EntityTaxBreakdown {
  entityId: string;
  entityName: string;
  entityType: string;
  properties: SA105PropertyData[];
  totalIncome: number;
  totalExpenses: number;
  totalProfit: number;
  totalFinanceCosts: number;
  applicableTaxRate: number;
  estimatedTax: number;
  section24Credit: number;
  netTax: number;
}

export interface AnnualTaxSummary {
  taxYear: string;
  properties: SA105PropertyData[];
  totalRentalIncome: number;
  totalAllowableExpenses: number;
  totalResidentialFinanceCosts: number;
  netPropertyIncome: number;
  section24TaxCredit: number;
  estimatedTaxLiability: number;
  perEntityBreakdown: EntityTaxBreakdown[];
}

// ── Tax expense categories for manual entries ──

export const TAX_EXPENSE_CATEGORIES = [
  { value: 'insurance', label: 'Insurance' },
  { value: 'management_fees', label: 'Management Fees' },
  { value: 'accountancy', label: 'Accountancy Fees' },
  { value: 'ground_rent', label: 'Ground Rent' },
  { value: 'service_charges', label: 'Service Charges' },
  { value: 'travel', label: 'Travel' },
  { value: 'other', label: 'Other' },
] as const;

export type TaxExpenseCategory = typeof TAX_EXPENSE_CATEGORIES[number]['value'];

// ── Calculators ──

export function calculateSection24(
  annualMortgageInterest: number,
  taxableProfit: number,
  marginalTaxRate: MarginalTaxRate
): Section24Calculation {
  const taxReliefAt20Percent = annualMortgageInterest * 0.20;
  // Under old rules: interest deducted, so profit lower, saved at marginal rate
  const taxSavedVsOldRules = annualMortgageInterest * marginalTaxRate;
  // Additional cost = difference between old-rule saving and new 20% credit
  const additionalTaxDueToS24 = Math.max(taxSavedVsOldRules - taxReliefAt20Percent, 0);
  // Effective rate on the profit
  const taxOnProfit = taxableProfit * marginalTaxRate;
  const netTax = taxOnProfit - taxReliefAt20Percent;
  const effectiveTaxRate = taxableProfit > 0 ? (netTax / taxableProfit) * 100 : 0;

  return {
    totalMortgageInterest: annualMortgageInterest,
    taxReliefAt20Percent,
    taxSavedVsOldRules,
    additionalTaxDueToS24,
    effectiveTaxRate,
  };
}

export function buildSA105(
  propertyId: string,
  propertyAddress: string,
  entityId: string | null,
  entityName: string | null,
  entityType: string | null,
  rentalIncome: number,
  mortgageInterest: number,
  repairsCost: number,
  manualExpenses: Record<string, number>,
  usePropertyAllowance: boolean
): SA105PropertyData {
  const insurance = manualExpenses['insurance'] || 0;
  const managementFees = manualExpenses['management_fees'] || 0;
  const accountingFees = manualExpenses['accountancy'] || 0;
  const groundRent = manualExpenses['ground_rent'] || 0;
  const serviceCharges = manualExpenses['service_charges'] || 0;
  const travel = manualExpenses['travel'] || 0;
  const other = manualExpenses['other'] || 0;
  const otherAllowableExpenses = travel + other;

  const totalAllowableExpenses = usePropertyAllowance
    ? Math.min(1000, rentalIncome)
    : repairsCost + insurance + managementFees + accountingFees + groundRent + serviceCharges + otherAllowableExpenses;

  const adjustedProfit = Math.max(rentalIncome - totalAllowableExpenses, 0);
  const taxCreditAt20Percent = mortgageInterest * 0.20;

  return {
    propertyId,
    propertyAddress,
    entityId,
    entityName,
    entityType,
    totalRentalIncome: rentalIncome,
    usePropertyAllowance,
    repairs: repairsCost,
    insurance,
    managementFees,
    accountingFees,
    groundRent,
    serviceCharges,
    otherAllowableExpenses,
    totalAllowableExpenses,
    residentialFinanceCosts: mortgageInterest,
    adjustedProfit,
    taxCreditAt20Percent,
  };
}

export function buildAnnualSummary(
  taxYear: string,
  properties: SA105PropertyData[],
  marginalTaxRate: MarginalTaxRate,
  corporationTaxRate: number
): AnnualTaxSummary {
  const totalRentalIncome = properties.reduce((s, p) => s + p.totalRentalIncome, 0);
  const totalAllowableExpenses = properties.reduce((s, p) => s + p.totalAllowableExpenses, 0);
  const totalResidentialFinanceCosts = properties.reduce((s, p) => s + p.residentialFinanceCosts, 0);
  const netPropertyIncome = totalRentalIncome - totalAllowableExpenses;

  // Group by entity
  const entityMap = new Map<string, SA105PropertyData[]>();
  for (const p of properties) {
    const key = p.entityId || '__personal__';
    if (!entityMap.has(key)) entityMap.set(key, []);
    entityMap.get(key)!.push(p);
  }

  const perEntityBreakdown: EntityTaxBreakdown[] = [];
  let totalTax = 0;
  let totalS24Credit = 0;

  for (const [key, props] of entityMap) {
    const first = props[0];
    const isSPV = first.entityType === 'spv' || first.entityType === 'limited_company';
    const rate = isSPV ? corporationTaxRate : marginalTaxRate;

    const entityIncome = props.reduce((s, p) => s + p.totalRentalIncome, 0);
    const entityExpenses = props.reduce((s, p) => s + p.totalAllowableExpenses, 0);
    const entityFinanceCosts = props.reduce((s, p) => s + p.residentialFinanceCosts, 0);
    const entityProfit = entityIncome - entityExpenses;

    let estimatedTax: number;
    let section24Credit = 0;

    if (isSPV) {
      // SPVs deduct interest normally
      const profitAfterInterest = Math.max(entityProfit - entityFinanceCosts, 0);
      estimatedTax = profitAfterInterest * rate;
    } else {
      // Personal: Section 24 applies
      estimatedTax = Math.max(entityProfit, 0) * rate;
      section24Credit = entityFinanceCosts * 0.20;
    }

    const netTax = Math.max(estimatedTax - section24Credit, 0);
    totalTax += netTax;
    totalS24Credit += section24Credit;

    perEntityBreakdown.push({
      entityId: key === '__personal__' ? '' : key,
      entityName: first.entityName || 'Personal',
      entityType: first.entityType || 'personal',
      properties: props,
      totalIncome: entityIncome,
      totalExpenses: entityExpenses,
      totalProfit: entityProfit,
      totalFinanceCosts: entityFinanceCosts,
      applicableTaxRate: rate,
      estimatedTax,
      section24Credit,
      netTax,
    });
  }

  return {
    taxYear,
    properties,
    totalRentalIncome,
    totalAllowableExpenses,
    totalResidentialFinanceCosts,
    netPropertyIncome,
    section24TaxCredit: totalS24Credit,
    estimatedTaxLiability: totalTax,
    perEntityBreakdown,
  };
}

// ── SA105 CSV Export ──

export function generateSA105CSV(properties: SA105PropertyData[]): string {
  const headers = [
    'Property Address', 'Entity', 'Total Rental Income', 'Repairs', 'Insurance',
    'Management Fees', 'Accounting Fees', 'Ground Rent', 'Service Charges',
    'Other Expenses', 'Total Allowable Expenses', 'Residential Finance Costs',
    'Adjusted Profit', 'Tax Credit (20%)',
  ];
  const rows = properties.map(p => [
    `"${p.propertyAddress}"`, `"${p.entityName || 'Personal'}"`,
    p.totalRentalIncome, p.repairs, p.insurance, p.managementFees, p.accountingFees,
    p.groundRent, p.serviceCharges, p.otherAllowableExpenses, p.totalAllowableExpenses,
    p.residentialFinanceCosts, p.adjustedProfit, p.taxCreditAt20Percent,
  ]);
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
