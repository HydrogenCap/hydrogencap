/**
 * Portfolio Dashboard - Calculation Utilities
 * All financial calculations in one place for consistency
 */

// Format currency in GBP with thousand separators
export function formatGBP(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Format currency with decimals
export function formatGBPDecimal(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Format percentage with % sign
export function formatPercent(value: number | null | undefined, decimals: number = 1): string {
  if (value == null) return '—';
  return `${value.toFixed(decimals)}%`;
}

// Format date in UK format
export function formatDateUK(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Format date in short format
export function formatDateShort(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ============================================================
// MORTGAGE PAYMENT CALCULATIONS
// ============================================================

export interface MortgagePaymentInputs {
  balance: number | null;
  interestRate: number | null; // Annual rate as percentage
  termMonths: number | null;
  isInterestOnly: boolean;
  paymentOverride: number | null;
}

/**
 * Calculate monthly mortgage payment
 * Returns the effective payment (override if set, otherwise auto-calculated)
 */
export function calculateMonthlyMortgagePayment(inputs: MortgagePaymentInputs): {
  autoCalculated: number | null;
  effective: number | null;
  source: 'auto' | 'manual' | null;
} {
  const { balance, interestRate, termMonths, isInterestOnly, paymentOverride } = inputs;
  
  // If manual override is set, use that
  if (paymentOverride !== null && paymentOverride > 0) {
    return {
      autoCalculated: calculateAutoPayment(balance, interestRate, termMonths, isInterestOnly),
      effective: paymentOverride,
      source: 'manual',
    };
  }

  const autoCalc = calculateAutoPayment(balance, interestRate, termMonths, isInterestOnly);
  return {
    autoCalculated: autoCalc,
    effective: autoCalc,
    source: autoCalc !== null ? 'auto' : null,
  };
}

function calculateAutoPayment(
  balance: number | null,
  interestRate: number | null,
  termMonths: number | null,
  isInterestOnly: boolean
): number | null {
  if (balance === null || balance <= 0) return null;
  if (interestRate === null || interestRate <= 0) return null;

  const monthlyRate = (interestRate / 100) / 12;

  // Interest-only calculation
  if (isInterestOnly) {
    return balance * monthlyRate;
  }

  // Repayment calculation (amortisation formula)
  if (termMonths === null || termMonths <= 0) return null;
  
  const n = termMonths;
  const r = monthlyRate;
  
  // P = L * [r(1+r)^n] / [(1+r)^n - 1]
  const numerator = r * Math.pow(1 + r, n);
  const denominator = Math.pow(1 + r, n) - 1;
  
  if (denominator === 0) return null;
  
  return balance * (numerator / denominator);
}

// ============================================================
// CORE FINANCIAL CALCULATIONS
// ============================================================

// Calculate LTV percentage (with divide-by-zero protection)
export function calculateLTV(
  mortgageBalance: number | null | undefined,
  currentValue: number | null | undefined
): number | null {
  if (!mortgageBalance || !currentValue || currentValue === 0) return null;
  return (mortgageBalance / currentValue) * 100;
}

// Calculate equity
export function calculateEquity(
  currentValue: number | null | undefined,
  mortgageBalance: number | null | undefined
): number | null {
  if (currentValue == null) return null;
  return currentValue - (mortgageBalance || 0);
}

// Calculate total annual costs
export function calculateTotalCosts(costs: {
  management_gbp?: number | null;
  bills_gbp?: number | null;
  insurance_gbp?: number | null;
  maintenance_gbp?: number | null;
  repairs_gbp?: number | null; // New name for maintenance
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

// ============================================================
// COSTS AUTO-CALCULATION SYSTEM
// ============================================================

export interface CostsData {
  // Manual amounts
  management_gbp_manual?: number | null;
  repairs_gbp_manual?: number | null;
  insurance_gbp_manual?: number | null;
  bills_gbp_manual?: number | null;
  compliance_gbp_manual?: number | null;
  other_gbp_manual?: number | null;
  
  // Rule toggles and settings
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
  
  // Sources for UI display
  managementSource: 'auto' | 'manual';
  insuranceSource: 'auto' | 'manual';
  repairsSource: 'auto' | 'manual';
}

/**
 * Calculate auto-calculated cost values based on rules
 */
export function calculateCostRules(
  grossRent: number | null,
  propertyValue: number | null,
  costs: CostsData
): { management: number | null; insurance: number | null; repairs: number | null } {
  // Management: % of gross rent
  const managementCalc = (costs.management_rule_enabled !== false && grossRent)
    ? grossRent * ((costs.management_rule_percent_of_rent ?? 5) / 100)
    : null;

  // Insurance: % of property value
  const insuranceCalc = (costs.insurance_rule_enabled !== false && propertyValue)
    ? propertyValue * ((costs.insurance_rule_percent_of_value ?? 0.3) / 100)
    : null;

  // Repairs: % of gross rent
  const repairsCalc = (costs.repairs_rule_enabled !== false && grossRent)
    ? grossRent * ((costs.repairs_rule_percent_of_rent ?? 5) / 100)
    : null;

  return { management: managementCalc, insurance: insuranceCalc, repairs: repairsCalc };
}

/**
 * Get effective cost amounts (manual overrides auto-calculated)
 */
export function getEffectiveCosts(
  grossRent: number | null,
  propertyValue: number | null,
  costs: CostsData | null | undefined
): EffectiveCosts {
  if (!costs) {
    return {
      management: 0,
      insurance: 0,
      repairs: 0,
      bills: 0,
      compliance: 0,
      other: 0,
      total: 0,
      managementSource: 'auto',
      insuranceSource: 'auto',
      repairsSource: 'auto',
    };
  }

  const calculated = calculateCostRules(grossRent, propertyValue, costs);

  // Management: manual overrides auto
  const hasManualManagement = costs.management_gbp_manual !== null && 
    costs.management_gbp_manual !== undefined && 
    costs.management_gbp_manual > 0;
  const management = hasManualManagement 
    ? Number(costs.management_gbp_manual) 
    : (calculated.management ?? 0);
  const managementSource = hasManualManagement ? 'manual' : 'auto';

  // Insurance: manual overrides auto
  const hasManualInsurance = costs.insurance_gbp_manual !== null && 
    costs.insurance_gbp_manual !== undefined && 
    costs.insurance_gbp_manual > 0;
  const insurance = hasManualInsurance 
    ? Number(costs.insurance_gbp_manual) 
    : (calculated.insurance ?? 0);
  const insuranceSource = hasManualInsurance ? 'manual' : 'auto';

  // Repairs: manual overrides auto
  const hasManualRepairs = costs.repairs_gbp_manual !== null && 
    costs.repairs_gbp_manual !== undefined && 
    costs.repairs_gbp_manual > 0;
  const repairs = hasManualRepairs 
    ? Number(costs.repairs_gbp_manual) 
    : (calculated.repairs ?? 0);
  const repairsSource = hasManualRepairs ? 'manual' : 'auto';

  // Static costs (no auto-calc)
  const bills = costs.bills_gbp_manual ? Number(costs.bills_gbp_manual) : 0;
  const compliance = costs.compliance_gbp_manual ? Number(costs.compliance_gbp_manual) : 0;
  const other = costs.other_gbp_manual ? Number(costs.other_gbp_manual) : 0;

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

// Calculate Net Operating Income (NOI) = annual rent - annual costs
export function calculateNOI(annualRent: number | null | undefined, totalCosts: number): number | null {
  if (annualRent == null) return null;
  return annualRent - totalCosts;
}

// Legacy alias for NOI
export function calculateNetRent(annualRent: number | null | undefined, totalCosts: number): number | null {
  return calculateNOI(annualRent, totalCosts);
}

// Calculate annual cashflow AFTER debt service
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

// Calculate monthly cashflow AFTER debt service
export function calculateMonthlyCashflowAfterDebt(
  annualRent: number | null,
  totalCosts: number,
  monthlyMortgagePayment: number | null
): number | null {
  const annualCashflow = calculateAnnualCashflowAfterDebt(annualRent, totalCosts, monthlyMortgagePayment);
  if (annualCashflow === null) return null;
  return annualCashflow / 12;
}

// Legacy: Calculate monthly net cashflow (NOI-based, for backwards compatibility)
export function calculateMonthlyCashflow(annualNetRent: number | null): number | null {
  if (annualNetRent == null) return null;
  return annualNetRent / 12;
}

// Calculate yield percentage (with divide-by-zero protection)
export function calculateYield(
  annualNetRent: number | null | undefined,
  currentValue: number | null | undefined
): number | null {
  if (annualNetRent == null || !currentValue || currentValue === 0) return null;
  return (annualNetRent / currentValue) * 100;
}

// Calculate ROCE (Return on Capital Employed) with divide-by-zero protection
export function calculateROCE(
  annualNetRent: number | null | undefined,
  equity: number | null | undefined
): number | null {
  if (annualNetRent == null || !equity || equity <= 0) return null;
  return (annualNetRent / equity) * 100;
}

// Days until a date
export function daysUntil(date: string | Date | null | undefined): number | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// Get risk status based on days until expiry
export function getExpiryStatus(
  expiryDate: string | Date | null | undefined
): 'expired' | 'critical' | 'warning' | 'ok' | null {
  const days = daysUntil(expiryDate);
  if (days === null) return null;
  if (days <= 0) return 'expired';
  if (days <= 30) return 'critical';
  if (days <= 90) return 'warning';
  return 'ok';
}

// Get LTV risk status
export function getLTVStatus(ltv: number | null): 'danger' | 'warning' | 'ok' | null {
  if (ltv === null) return null;
  if (ltv > 85) return 'danger';
  if (ltv > 75) return 'warning';
  return 'ok';
}

// Get EPC risk status (updated to handle N/A and epc_required)
export function getEPCStatus(
  rating: string | null | undefined, 
  epcRequired: boolean = true
): 'warning' | 'ok' | 'exempt' | null {
  // If EPC is not required (listed building), it's exempt
  if (!epcRequired) return 'exempt';
  
  if (!rating) return null;
  
  const upperRating = rating.toUpperCase();
  
  // N/A is only valid when epc_required is false, but handle gracefully
  if (upperRating === 'N/A') return 'exempt';
  
  // D, E, F, G are below C threshold
  if (['D', 'E', 'F', 'G'].includes(upperRating)) return 'warning';
  
  return 'ok';
}

// Check if EPC rating is valid
export function isValidEPCRating(rating: string | null | undefined): boolean {
  if (!rating) return false;
  const validRatings = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'N/A'];
  return validRatings.includes(rating.toUpperCase());
}

// Parse postcode area from full postcode
export function extractPostcodeArea(postcode: string | null | undefined): string | null {
  if (!postcode) return null;
  const match = postcode.toUpperCase().match(/^([A-Z]{1,2})/);
  return match ? match[1] : null;
}

// ============================================================
// Property Health Score System
// ============================================================

export interface HealthScoreBreakdown {
  cashflow: number;      // 0-25 points
  leverage: number;      // 0-25 points
  risk: number;          // 0-25 points
  compliance: number;    // 0-25 points
  total: number;         // 0-100 overall
}

export interface PropertyHealthInputs {
  // Cashflow (uses cashflow after debt)
  annualRent: number | null;
  totalCosts: number;
  mortgagePayment: number | null; // Monthly mortgage payment
  
  // Leverage
  ltv: number | null;
  
  // Risk
  fixedRateExpires: string | null;
  isInterestOnly: boolean;
  
  // Compliance
  epcRating: string | null;
  epcRequired?: boolean; // false for listed buildings
  hasGasSafety?: boolean;
  hasEICR?: boolean;
}

/**
 * Calculate a health score for a property (0-100)
 * Higher score = healthier property
 */
export function calculateHealthScore(inputs: PropertyHealthInputs): HealthScoreBreakdown {
  const { 
    annualRent, 
    totalCosts, 
    mortgagePayment,
    ltv,
    fixedRateExpires,
    isInterestOnly,
    epcRating,
  } = inputs;

  // 1. CASHFLOW SCORE (0-25)
  let cashflowScore = 0;
  if (annualRent !== null) {
    const annualMortgage = (mortgagePayment || 0) * 12;
    const netIncome = annualRent - totalCosts - annualMortgage;
    const monthlyCashflow = netIncome / 12;
    
    if (monthlyCashflow >= 300) cashflowScore = 25;
    else if (monthlyCashflow >= 200) cashflowScore = 22;
    else if (monthlyCashflow >= 100) cashflowScore = 18;
    else if (monthlyCashflow >= 0) cashflowScore = 12;
    else if (monthlyCashflow >= -100) cashflowScore = 6;
    else cashflowScore = 0;
  }

  // 2. LEVERAGE SCORE (0-25)
  let leverageScore = 0;
  if (ltv !== null) {
    if (ltv <= 50) leverageScore = 25;
    else if (ltv <= 60) leverageScore = 22;
    else if (ltv <= 70) leverageScore = 18;
    else if (ltv <= 75) leverageScore = 14;
    else if (ltv <= 80) leverageScore = 10;
    else if (ltv <= 85) leverageScore = 5;
    else leverageScore = 0;
  } else {
    // No mortgage = full equity = max score
    leverageScore = 25;
  }

  // 3. RISK SCORE (0-25)
  let riskScore = 25;
  
  // Fixed rate expiry penalty
  if (fixedRateExpires) {
    const days = daysUntil(fixedRateExpires);
    if (days !== null) {
      if (days <= 0) riskScore -= 15; // Expired
      else if (days <= 30) riskScore -= 12;
      else if (days <= 60) riskScore -= 8;
      else if (days <= 90) riskScore -= 4;
    }
  }
  
  // Interest-only penalty
  if (isInterestOnly) {
    riskScore -= 5;
  }
  
  riskScore = Math.max(0, riskScore);

  // 4. COMPLIANCE SCORE (0-25)
  let complianceScore = 25;
  const epcRequired = inputs.epcRequired !== false; // Default to true
  
  // EPC rating penalty (only if EPC is required)
  if (epcRequired) {
    if (epcRating) {
      const rating = epcRating.toUpperCase();
      if (rating === 'N/A') {
        // N/A when EPC is required is a problem
        complianceScore -= 10;
      } else if (rating === 'F' || rating === 'G') {
        complianceScore -= 15;
      } else if (rating === 'E') {
        complianceScore -= 10;
      } else if (rating === 'D') {
        complianceScore -= 5;
      }
      // A, B, C = no penalty
    } else {
      // No EPC on file when required = penalty
      complianceScore -= 10;
    }
  }
  // If EPC not required (listed building), no penalty
  
  complianceScore = Math.max(0, complianceScore);

  // TOTAL
  const total = cashflowScore + leverageScore + riskScore + complianceScore;

  return {
    cashflow: cashflowScore,
    leverage: leverageScore,
    risk: riskScore,
    compliance: complianceScore,
    total,
  };
}

/**
 * Get health grade from score
 */
export function getHealthGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/**
 * Get status color class for health grade
 */
export function getHealthStatus(grade: 'A' | 'B' | 'C' | 'D' | 'F'): 'success' | 'warning' | 'danger' {
  if (grade === 'A' || grade === 'B') return 'success';
  if (grade === 'C') return 'warning';
  return 'danger';
}
