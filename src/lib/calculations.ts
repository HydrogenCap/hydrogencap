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
