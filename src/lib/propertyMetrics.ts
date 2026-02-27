// ============================================
// PROPERTY METRICS CALCULATIONS
// Centralized financial metrics and risk calculations
// ============================================

import { PropertyWithFinancials } from '@/hooks/usePropertiesCompat';
import { type PropertyPassport } from '@/hooks/usePropertyPassport';
import {
  calculateLTV,
  calculateEquity,
  getEffectiveCosts,
  calculateNetRent,
  calculateYield,
  calculateMonthlyMortgagePayment,
  getExpiryStatus,
  getEPCStatus,
} from '@/lib/calculations';

export type RiskLevel = 'critical' | 'warning' | 'ok';

export interface PropertyMetrics {
  mortgageBalance: number | null;
  currentValue: number | null;
  purchasePrice: number | null;
  annualRent: number | null;
  billsManagement: number;
  totalCosts: number;
  ltv: number | null;
  equity: number | null;
  netRent: number | null;
  yieldPercent: number | null;
  mortgagePayment: number | null;
  monthlyCashflow: number | null;
  loan: PropertyWithFinancials['loans'][0] | undefined;
}

export interface RiskAssessment {
  level: RiskLevel;
  issues: string[];
}

/**
 * Calculate all financial metrics for a property
 */
export function getPropertyMetrics(property: PropertyWithFinancials): PropertyMetrics {
  const currentYear = new Date().getFullYear();
  const loan = property.loans?.[0];
  const income = property.income?.find(i => i.year === currentYear);
  const costs = property.costs?.find(c => c.year === currentYear);

  const mortgageBalance = loan?.current_mortgage_balance_gbp ? Number(loan.current_mortgage_balance_gbp) : null;
  const currentValue = property.current_value_gbp ? Number(property.current_value_gbp) : null;
  const purchasePrice = property.purchase_price_gbp ? Number(property.purchase_price_gbp) : null;
  
  // Derive annual rent: prefer income table, fallback to sum of active tenancy PCMs * 12
  let annualRent = income?.annual_rent_gbp ? Number(income.annual_rent_gbp) : null;
  if (annualRent === null && property.tenancies?.length) {
    const activeTenancies = property.tenancies.filter(t => t.status === 'active');
    if (activeTenancies.length > 0) {
      const totalPcm = activeTenancies.reduce((sum, t) => sum + (Number(t.rent_amount_pcm) || 0), 0);
      if (totalPcm > 0) annualRent = totalPcm * 12;
    }
  }
  
  // Use effective costs (auto-calculated with manual overrides)
  const effectiveCosts = getEffectiveCosts(annualRent, currentValue, costs);
  const managementCost = effectiveCosts.management;
  const billsCost = effectiveCosts.bills;
  const billsManagement = managementCost + billsCost;
  const totalCosts = effectiveCosts.total;

  const ltv = calculateLTV(mortgageBalance, currentValue);
  const equity = calculateEquity(currentValue, mortgageBalance);
  const netRent = calculateNetRent(annualRent, totalCosts);
  const yieldPercent = calculateYield(netRent, currentValue);

  // Calculate monthly mortgage payment
  const mortgagePaymentResult = calculateMonthlyMortgagePayment({
    balance: mortgageBalance,
    interestRate: loan?.interest_rate_percent ? Number(loan.interest_rate_percent) : null,
    termMonths: loan?.loan_term_months ? Number(loan.loan_term_months) : null,
    isInterestOnly: loan?.capital_or_interest === 'interest',
    paymentOverride: loan?.payment_override_gbp ? Number(loan.payment_override_gbp) : null,
  });

  // Monthly cashflow = (net rent / 12) - monthly mortgage
  const monthlyNetRent = netRent !== null ? netRent / 12 : null;
  const monthlyCashflow = monthlyNetRent !== null && mortgagePaymentResult.effective !== null
    ? monthlyNetRent - mortgagePaymentResult.effective
    : monthlyNetRent;

  return {
    mortgageBalance,
    currentValue,
    purchasePrice,
    annualRent,
    billsManagement,
    totalCosts,
    ltv,
    equity,
    netRent,
    yieldPercent,
    mortgagePayment: mortgagePaymentResult.effective,
    monthlyCashflow,
    loan,
  };
}

/**
 * Calculate risk assessment for a property
 */
export function calculatePropertyRisk(
  property: PropertyWithFinancials,
  passport: PropertyPassport | undefined,
  metrics: PropertyMetrics
): RiskAssessment {
  const issues: string[] = [];
  let level: RiskLevel = 'ok';

  // LTV > 85% = critical, > 75% = warning
  if (metrics.ltv !== null) {
    if (metrics.ltv > 85) {
      issues.push('LTV > 85%');
      level = 'critical';
    } else if (metrics.ltv > 75) {
      issues.push('LTV > 75%');
      if (level === 'ok') level = 'warning';
    }
  }

  // Fixed rate expiry
  if (metrics.loan?.fixed_rate_expires) {
    const status = getExpiryStatus(metrics.loan.fixed_rate_expires);
    if (status === 'expired') {
      issues.push('Fixed rate expired');
      level = 'critical';
    } else if (status === 'critical' || status === 'warning') {
      issues.push('Fixed rate expiring soon');
      if (level === 'ok') level = 'warning';
    }
  }

  // EPC rating (if not exempt)
  if (property.epc_required !== false) {
    const epcStatus = getEPCStatus(property.epc_rating, property.epc_required ?? true);
    if (epcStatus === 'warning') {
      issues.push('EPC below C');
      if (level === 'ok') level = 'warning';
    }
  }

  // HMO licence (from passport)
  if (passport?.hmo_licence_required && passport.hmo_licence_expiry) {
    const status = getExpiryStatus(passport.hmo_licence_expiry);
    if (status === 'expired') {
      issues.push('HMO licence expired');
      level = 'critical';
    } else if (status === 'critical' || status === 'warning') {
      issues.push('HMO licence expiring');
      if (level === 'ok') level = 'warning';
    }
  }

  // Negative monthly cashflow
  if (metrics.monthlyCashflow !== null && metrics.monthlyCashflow < 0) {
    issues.push('Negative cashflow');
    if (level === 'ok') level = 'warning';
  }

  return { level, issues };
}

/**
 * Risk level sort order
 */
export const RISK_ORDER: Record<RiskLevel, number> = { 
  critical: 3, 
  warning: 2, 
  ok: 1 
};
