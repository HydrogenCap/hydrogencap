/**
 * Portfolio Dashboard - Calculation Utilities
 * All financial calculations in one place for consistency
 */

// Format currency in GBP
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

// Format percentage
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

// Calculate LTV percentage
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
  compliance_gbp?: number | null;
  other_gbp?: number | null;
}): number {
  return (
    (costs.management_gbp || 0) +
    (costs.bills_gbp || 0) +
    (costs.insurance_gbp || 0) +
    (costs.maintenance_gbp || 0) +
    (costs.compliance_gbp || 0) +
    (costs.other_gbp || 0)
  );
}

// Calculate annual net rent
export function calculateNetRent(annualRent: number | null | undefined, totalCosts: number): number | null {
  if (annualRent == null) return null;
  return annualRent - totalCosts;
}

// Calculate monthly net cashflow
export function calculateMonthlyCashflow(annualNetRent: number | null): number | null {
  if (annualNetRent == null) return null;
  return annualNetRent / 12;
}

// Calculate yield percentage
export function calculateYield(
  annualNetRent: number | null | undefined,
  currentValue: number | null | undefined
): number | null {
  if (!annualNetRent || !currentValue || currentValue === 0) return null;
  return (annualNetRent / currentValue) * 100;
}

// Calculate ROCE (Return on Capital Employed)
export function calculateROCE(
  annualNetRent: number | null | undefined,
  equity: number | null | undefined
): number | null {
  if (!annualNetRent || !equity || equity <= 0) return null;
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

// Get EPC risk status
export function getEPCStatus(rating: string | null | undefined): 'warning' | 'ok' | null {
  if (!rating) return null;
  if (['D', 'E', 'F', 'G'].includes(rating.toUpperCase())) return 'warning';
  return 'ok';
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
  // Cashflow
  annualRent: number | null;
  totalCosts: number;
  mortgagePayment: number | null;
  
  // Leverage
  ltv: number | null;
  
  // Risk
  fixedRateExpires: string | null;
  isInterestOnly: boolean;
  
  // Compliance
  epcRating: string | null;
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
  
  // EPC rating penalty
  if (epcRating) {
    const rating = epcRating.toUpperCase();
    if (rating === 'F' || rating === 'G') complianceScore -= 15;
    else if (rating === 'E') complianceScore -= 10;
    else if (rating === 'D') complianceScore -= 5;
    // A, B, C = no penalty
  } else {
    // No EPC on file = penalty
    complianceScore -= 10;
  }
  
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
