/**
 * UK Property Tax Engine — TenureIQ
 *
 * Covers:
 *   • Income tax band calculation with personal allowance tapering
 *   • Section 24 mortgage interest relief restriction (old vs new system)
 *   • SA105 property income aggregation (per-property and portfolio totals)
 *   • Capital Gains Tax estimates for residential property disposals
 *
 * DISCLAIMER: Estimates only — consult a qualified accountant for tax advice.
 */

// ── UK Tax Bands 2025-26 ──

export const TAX_BANDS_2025_26 = {
  personalAllowance: 12_570,
  personalAllowanceTaperThreshold: 100_000,
  basicRate: { limit: 50_270, rate: 0.20 },
  higherRate: { limit: 125_140, rate: 0.40 },
  additionalRate: { rate: 0.45 },
} as const;

export const CGT_RATES = {
  basic: 0.18,
  higher: 0.24,
  annualExemptAmount: 3_000, // 2025-26
} as const;

export const CORPORATION_TAX = {
  smallProfitsRate: 0.19,
  smallProfitsLimit: 50_000,
  mainRate: 0.25,
  mainRateLimit: 250_000,
} as const;

// ── Types ──

export interface TaxProfileInput {
  taxpayerType: 'individual' | 'partnership' | 'company';
  otherIncome: number;
  personalAllowance: number;
  incomeTaxRate?: number;
}

export interface PropertyTaxData {
  propertyId: string;
  propertyAddress: string;
  entityId: string | null;
  entityName: string | null;
  entityType: string | null;
  grossRent: number;
  allowableExpenses: number;
  financeCosts: number; // mortgage interest
  purchasePrice: number | null;
  currentValue: number | null;
  improvementCosts: number;
  expenseBreakdown: Record<string, number>;
}

export interface Section24Result {
  oldSystemTax: number;
  newSystemTax: number;
  additionalTaxDueToSection24: number;
  financeCredit: number;
  effectiveRate: number;
  oldEffectiveRate: number;
}

export interface CGTResult {
  gain: number;
  taxableGain: number;
  cgt: number;
  rate: number;
  annualExemptAmount: number;
}

export interface SA105Line {
  propertyId: string;
  propertyAddress: string;
  entityId: string | null;
  entityName: string | null;
  entityType: string | null;
  // SA105 boxes
  box20_totalRents: number;
  box21_taxDeducted: number;
  box24_premiumsGrant: number;
  box25_reversePremiums: number;
  box26_repairsMaintenance: number;
  box27_financeCosts: number;
  box28_legalManagement: number;
  box29_otherExpenses: number;
  box30_totalAllowable: number;
  box31_adjustedProfit: number;
  box38_basicRateReduction: number;
  expenseBreakdown: Record<string, number>;
}

export interface SA105Summary {
  lines: SA105Line[];
  totalRents: number;
  totalAllowableExpenses: number;
  totalFinanceCosts: number;
  totalAdjustedProfit: number;
  totalBasicRateReduction: number;
}

export interface TaxCalculationResult {
  taxYear: string;
  profile: TaxProfileInput;
  sa105: SA105Summary;
  section24Impact: Section24Result;
  cgtEstimates: Array<{
    propertyId: string;
    propertyAddress: string;
    purchasePrice: number;
    currentValue: number;
    result: CGTResult;
  }>;
  totalPropertyIncome: number;
  totalTaxLiability: number;
  effectiveTaxRate: number;
  perPropertyTax: Array<{
    propertyId: string;
    propertyAddress: string;
    grossRent: number;
    allowableExpenses: number;
    financeCosts: number;
    netIncome: number;
    taxLiability: number;
  }>;
}

// ── Income Tax Calculator ──

/**
 * Calculate income tax using progressive UK bands.
 * Handles personal allowance tapering above £100k.
 */
export function calculateIncomeTax(totalIncome: number, personalAllowance: number): number {
  const bands = TAX_BANDS_2025_26;

  // Personal allowance tapering: reduced by £1 for every £2 above £100k
  let effectiveAllowance = personalAllowance;
  if (totalIncome > bands.personalAllowanceTaperThreshold) {
    const reduction = Math.floor((totalIncome - bands.personalAllowanceTaperThreshold) / 2);
    effectiveAllowance = Math.max(0, personalAllowance - reduction);
  }

  const taxable = Math.max(0, totalIncome - effectiveAllowance);
  let tax = 0;
  let remaining = taxable;

  // Basic rate band (£0 – £37,700 of taxable income i.e. up to £50,270 total)
  const basicBandWidth = bands.basicRate.limit - bands.personalAllowance;
  const basicAmount = Math.min(remaining, basicBandWidth);
  tax += basicAmount * bands.basicRate.rate;
  remaining -= basicAmount;

  // Higher rate band (£37,700 – £112,570 of taxable income)
  const higherBandWidth = bands.higherRate.limit - bands.basicRate.limit;
  const higherAmount = Math.min(remaining, higherBandWidth);
  tax += higherAmount * bands.higherRate.rate;
  remaining -= higherAmount;

  // Additional rate (above £125,140)
  if (remaining > 0) {
    tax += remaining * bands.additionalRate.rate;
  }

  return tax;
}

/**
 * Determine the marginal tax rate for a given income level.
 */
export function getMarginalRate(totalIncome: number, personalAllowance: number): number {
  const bands = TAX_BANDS_2025_26;
  let effectiveAllowance = personalAllowance;
  if (totalIncome > bands.personalAllowanceTaperThreshold) {
    const reduction = Math.floor((totalIncome - bands.personalAllowanceTaperThreshold) / 2);
    effectiveAllowance = Math.max(0, personalAllowance - reduction);
  }
  const taxable = totalIncome - effectiveAllowance;
  if (taxable <= 0) return 0;
  const basicBandWidth = bands.basicRate.limit - bands.personalAllowance;
  if (taxable <= basicBandWidth) return bands.basicRate.rate;
  const higherBandWidth = bands.higherRate.limit - bands.basicRate.limit;
  if (taxable <= basicBandWidth + higherBandWidth) return bands.higherRate.rate;
  return bands.additionalRate.rate;
}

// ── Section 24 ──

/**
 * Calculate the impact of Section 24 mortgage interest restriction.
 *
 * Under the old system (pre-2020-21), landlords deducted mortgage interest
 * from rental income before calculating tax.
 *
 * Under the new system (Section 24, fully phased in), mortgage interest is
 * NOT deductible but landlords receive a 20% basic rate tax credit instead.
 *
 * This function compares both systems to show the additional tax burden.
 */
export function calculateSection24Impact(params: {
  grossRent: number;
  allowableExpenses: number;
  financeCosts: number;
  otherIncome: number;
  personalAllowance: number;
}): Section24Result {
  const { grossRent, allowableExpenses, financeCosts, otherIncome, personalAllowance } = params;

  // OLD system: deduct finance costs from income
  const oldNetPropertyIncome = Math.max(0, grossRent - allowableExpenses - financeCosts);
  const oldTotalIncome = oldNetPropertyIncome + otherIncome;
  const oldTax = calculateIncomeTax(oldTotalIncome, personalAllowance);

  // NEW system (Section 24): finance costs NOT deductible, 20% credit instead
  const newNetPropertyIncome = Math.max(0, grossRent - allowableExpenses);
  const newTotalIncome = newNetPropertyIncome + otherIncome;
  const newTaxBeforeCredit = calculateIncomeTax(newTotalIncome, personalAllowance);
  const financeCredit = financeCosts * 0.20;
  const newTaxAfterCredit = Math.max(0, newTaxBeforeCredit - financeCredit);

  const netPropertyIncome = grossRent - allowableExpenses;
  const effectiveRate = netPropertyIncome > 0
    ? (newTaxAfterCredit / netPropertyIncome) * 100
    : 0;
  const oldEffectiveRate = oldNetPropertyIncome > 0
    ? (oldTax / oldNetPropertyIncome) * 100
    : 0;

  return {
    oldSystemTax: oldTax,
    newSystemTax: newTaxAfterCredit,
    additionalTaxDueToSection24: Math.max(0, newTaxAfterCredit - oldTax),
    financeCredit,
    effectiveRate,
    oldEffectiveRate,
  };
}

// ── Capital Gains Tax ──

export function calculateCGT(params: {
  purchasePrice: number;
  currentValue: number;
  improvementCosts: number;
  annualExemptAmount: number;
  taxpayerRate: 'basic' | 'higher';
}): CGTResult {
  const { purchasePrice, currentValue, improvementCosts, annualExemptAmount, taxpayerRate } = params;
  const gain = currentValue - purchasePrice - improvementCosts;
  const taxableGain = Math.max(0, gain - annualExemptAmount);
  const rate = taxpayerRate === 'basic' ? CGT_RATES.basic : CGT_RATES.higher;
  return {
    gain,
    taxableGain,
    cgt: taxableGain * rate,
    rate,
    annualExemptAmount,
  };
}

// ── SA105 Builder ──

export function buildSA105Line(property: PropertyTaxData): SA105Line {
  const eb = property.expenseBreakdown;
  const repairs = eb['repairs'] || 0;
  const insurance = eb['insurance'] || 0;
  const managementFees = eb['management_fees'] || 0;
  const accountingFees = eb['accountancy'] || 0;
  const groundRent = eb['ground_rent'] || 0;
  const serviceCharges = eb['service_charges'] || 0;
  const travel = eb['travel'] || 0;
  const other = eb['other'] || 0;

  const box26 = repairs;
  const box27 = property.financeCosts;
  const box28 = managementFees + accountingFees;
  const box29 = insurance + groundRent + serviceCharges + travel + other;
  const box30 = box26 + box28 + box29; // total allowable (finance costs separate in S24)
  const box31 = Math.max(0, property.grossRent - box30);
  const box38 = property.financeCosts * 0.20;

  return {
    propertyId: property.propertyId,
    propertyAddress: property.propertyAddress,
    entityId: property.entityId,
    entityName: property.entityName,
    entityType: property.entityType,
    box20_totalRents: property.grossRent,
    box21_taxDeducted: 0,
    box24_premiumsGrant: 0,
    box25_reversePremiums: 0,
    box26_repairsMaintenance: box26,
    box27_financeCosts: box27,
    box28_legalManagement: box28,
    box29_otherExpenses: box29,
    box30_totalAllowable: box30,
    box31_adjustedProfit: box31,
    box38_basicRateReduction: box38,
    expenseBreakdown: property.expenseBreakdown,
  };
}

export function buildSA105Summary(properties: PropertyTaxData[]): SA105Summary {
  const lines = properties.map(buildSA105Line);
  return {
    lines,
    totalRents: lines.reduce((s, l) => s + l.box20_totalRents, 0),
    totalAllowableExpenses: lines.reduce((s, l) => s + l.box30_totalAllowable, 0),
    totalFinanceCosts: lines.reduce((s, l) => s + l.box27_financeCosts, 0),
    totalAdjustedProfit: lines.reduce((s, l) => s + l.box31_adjustedProfit, 0),
    totalBasicRateReduction: lines.reduce((s, l) => s + l.box38_basicRateReduction, 0),
  };
}

// ── Full Tax Calculation ──

export function runTaxCalculation(
  taxYear: string,
  profile: TaxProfileInput,
  properties: PropertyTaxData[],
): TaxCalculationResult {
  // Only individual properties affected by Section 24
  const personalProperties = properties.filter(p => {
    const t = p.entityType;
    return !t || t === 'personal' || t === 'partnership';
  });
  const companyProperties = properties.filter(p => {
    const t = p.entityType;
    return t === 'spv' || t === 'limited_company' || t === 'company';
  });

  // SA105
  const sa105 = buildSA105Summary(personalProperties);

  // Section 24 impact for personal properties
  const totalGrossRent = personalProperties.reduce((s, p) => s + p.grossRent, 0);
  const totalAllowableExpenses = personalProperties.reduce((s, p) => s + p.allowableExpenses, 0);
  const totalFinanceCosts = personalProperties.reduce((s, p) => s + p.financeCosts, 0);

  const section24Impact = calculateSection24Impact({
    grossRent: totalGrossRent,
    allowableExpenses: totalAllowableExpenses,
    financeCosts: totalFinanceCosts,
    otherIncome: profile.otherIncome,
    personalAllowance: profile.personalAllowance,
  });

  // CGT estimates
  const marginalRate = getMarginalRate(
    totalGrossRent - totalAllowableExpenses + profile.otherIncome,
    profile.personalAllowance,
  );
  const taxpayerRate: 'basic' | 'higher' = marginalRate <= 0.20 ? 'basic' : 'higher';

  const cgtEstimates = properties
    .filter(p => p.purchasePrice != null && p.currentValue != null)
    .map(p => ({
      propertyId: p.propertyId,
      propertyAddress: p.propertyAddress,
      purchasePrice: p.purchasePrice!,
      currentValue: p.currentValue!,
      result: calculateCGT({
        purchasePrice: p.purchasePrice!,
        currentValue: p.currentValue!,
        improvementCosts: p.improvementCosts,
        annualExemptAmount: CGT_RATES.annualExemptAmount,
        taxpayerRate,
      }),
    }));

  // Per-property tax estimates
  const perPropertyTax = personalProperties.map(p => {
    const netIncome = Math.max(0, p.grossRent - p.allowableExpenses);
    const proportionalTax = totalGrossRent > 0
      ? section24Impact.newSystemTax * (p.grossRent / totalGrossRent)
      : 0;
    return {
      propertyId: p.propertyId,
      propertyAddress: p.propertyAddress,
      grossRent: p.grossRent,
      allowableExpenses: p.allowableExpenses,
      financeCosts: p.financeCosts,
      netIncome,
      taxLiability: proportionalTax,
    };
  });

  // Company property tax
  const companyPropertyTax = companyProperties.map(p => {
    const netIncome = Math.max(0, p.grossRent - p.allowableExpenses - p.financeCosts);
    const rate = profile.incomeTaxRate ?? CORPORATION_TAX.mainRate;
    return {
      propertyId: p.propertyId,
      propertyAddress: p.propertyAddress,
      grossRent: p.grossRent,
      allowableExpenses: p.allowableExpenses,
      financeCosts: p.financeCosts,
      netIncome,
      taxLiability: netIncome * rate,
    };
  });

  const allPropertyTax = [...perPropertyTax, ...companyPropertyTax];
  const totalTaxLiability = allPropertyTax.reduce((s, p) => s + p.taxLiability, 0);
  const totalPropertyIncome = allPropertyTax.reduce((s, p) => s + p.netIncome, 0);
  const effectiveTaxRate = totalPropertyIncome > 0
    ? (totalTaxLiability / totalPropertyIncome) * 100
    : 0;

  return {
    taxYear,
    profile,
    sa105,
    section24Impact,
    cgtEstimates,
    totalPropertyIncome,
    totalTaxLiability,
    effectiveTaxRate,
    perPropertyTax: allPropertyTax,
  };
}
