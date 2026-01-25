/**
 * Portfolio Insights - Deterministic Metrics Calculator
 * All metrics are calculated from actual portfolio data, no guessing.
 */

import { PropertyWithFinancials } from '@/hooks/useProperties';
import { PropertyPassport, calculatePassportCompleteness } from '@/hooks/usePropertyPassport';
import {
  calculateLTV,
  calculateEquity,
  getEffectiveCosts,
  calculateNOI,
  calculateAnnualCashflowAfterDebt,
  calculateMonthlyMortgagePayment,
  daysUntil,
} from './calculations';

// ============================================================
// TYPES
// ============================================================

export interface DebtMetrics {
  weightedAverageInterestRate: number | null;
  totalMortgageBalance: number;
  expiringIn3Months: { count: number; balance: number; percent: number };
  expiringIn6Months: { count: number; balance: number; percent: number };
  expiringIn12Months: { count: number; balance: number; percent: number };
  lenderConcentration: { lender: string; balance: number; percent: number }[];
}

export interface CashflowMetrics {
  totalGrossRent: number;
  totalNOI: number;
  totalCashflowAfterDebt: number;
  noiMargin: number | null;
  cashflowMargin: number | null;
  negativeProperties: { count: number; totalValue: number; properties: string[] };
}

export interface ReturnMetrics {
  portfolioNetYield: number | null;
  portfolioROCE: number | null;
  rentPerBedroomMonthly: number | null;
  rentPerBedroomAnnual: number | null;
  totalBedrooms: number;
  totalEquity: number;
  totalValue: number;
}

export interface RiskMetrics {
  ltvAbove75: { count: number; value: number; percent: number; properties: string[] };
  ltvAbove85: { count: number; value: number; percent: number; properties: string[] };
  epcBelowC: { count: number; properties: string[] };
  pre2000Count: number;
}

export interface OperationalMetrics {
  averagePassportCompleteness: number;
  propertiesMissingCritical: { count: number; properties: string[] };
}

export interface PortfolioInsights {
  debt: DebtMetrics;
  cashflow: CashflowMetrics;
  returns: ReturnMetrics;
  risk: RiskMetrics;
  operational: OperationalMetrics;
  propertyCount: number;
}

export interface ActionItem {
  id: string;
  severity: 'red' | 'yellow';
  title: string;
  description: string;
  count: number;
  propertyIds: string[];
  filterType: string;
}

// ============================================================
// CALCULATIONS
// ============================================================

export function calculatePortfolioInsights(
  properties: PropertyWithFinancials[],
  passports: PropertyPassport[]
): PortfolioInsights {
  const currentYear = new Date().getFullYear();
  const passportMap = new Map(passports.map(p => [p.property_id, p]));

  // Initialize accumulators
  let totalMortgageBalance = 0;
  let weightedRateSum = 0;
  let totalGrossRent = 0;
  let totalNOI = 0;
  let totalCashflowAfterDebt = 0;
  let totalValue = 0;
  let totalEquity = 0;
  let totalBedrooms = 0;
  let passportCompletenessSum = 0;
  let passportCount = 0;

  const lenderBalances: Map<string, number> = new Map();
  const expiring3m: { count: number; balance: number; properties: string[] } = { count: 0, balance: 0, properties: [] };
  const expiring6m: { count: number; balance: number; properties: string[] } = { count: 0, balance: 0, properties: [] };
  const expiring12m: { count: number; balance: number; properties: string[] } = { count: 0, balance: 0, properties: [] };
  const negativeProperties: string[] = [];
  let negativeTotalValue = 0;
  const ltvAbove75: { value: number; properties: string[] } = { value: 0, properties: [] };
  const ltvAbove85: { value: number; properties: string[] } = { value: 0, properties: [] };
  const epcBelowC: string[] = [];
  let pre2000Count = 0;
  const missingCritical: string[] = [];

  properties.forEach(property => {
    const loan = property.loans?.[0];
    const income = property.income?.find(i => i.year === currentYear);
    const costs = property.costs?.find(c => c.year === currentYear);
    const passport = passportMap.get(property.id);

    const currentValue = property.current_value_gbp ? Number(property.current_value_gbp) : 0;
    const mortgageBalance = loan?.current_mortgage_balance_gbp ? Number(loan.current_mortgage_balance_gbp) : 0;
    const interestRate = loan?.interest_rate_percent ? Number(loan.interest_rate_percent) : null;
    const annualRent = income?.annual_rent_gbp ? Number(income.annual_rent_gbp) : 0;
    const beds = property.beds ? Number(property.beds) : 0;

    // Totals
    totalValue += currentValue;
    totalMortgageBalance += mortgageBalance;
    totalGrossRent += annualRent;
    totalBedrooms += beds;

    // Weighted interest rate
    if (interestRate && mortgageBalance > 0) {
      weightedRateSum += interestRate * mortgageBalance;
    }

    // Lender concentration
    if (loan?.lender && mortgageBalance > 0) {
      const existing = lenderBalances.get(loan.lender) || 0;
      lenderBalances.set(loan.lender, existing + mortgageBalance);
    }

    // Rate expiry tracking
    if (loan?.fixed_rate_expires && mortgageBalance > 0) {
      const days = daysUntil(loan.fixed_rate_expires);
      if (days !== null && days > 0) {
        if (days <= 90) {
          expiring3m.count++;
          expiring3m.balance += mortgageBalance;
          expiring3m.properties.push(property.id);
        }
        if (days <= 180) {
          expiring6m.count++;
          expiring6m.balance += mortgageBalance;
          expiring6m.properties.push(property.id);
        }
        if (days <= 365) {
          expiring12m.count++;
          expiring12m.balance += mortgageBalance;
          expiring12m.properties.push(property.id);
        }
      }
    }

    // Calculate NOI and cashflow
    const effectiveCosts = getEffectiveCosts(annualRent, currentValue, costs);
    const noi = calculateNOI(annualRent, effectiveCosts.total);
    
    // Calculate mortgage payment
    const paymentResult = calculateMonthlyMortgagePayment({
      balance: mortgageBalance,
      interestRate: interestRate,
      termMonths: loan?.loan_term_months ? Number(loan.loan_term_months) : null,
      isInterestOnly: loan?.capital_or_interest === 'interest_only',
      paymentOverride: loan?.payment_override_gbp ? Number(loan.payment_override_gbp) : null,
    });
    
    const cashflowAfterDebt = calculateAnnualCashflowAfterDebt(
      annualRent || null,
      effectiveCosts.total,
      paymentResult.effective
    );

    if (noi !== null) totalNOI += noi;
    if (cashflowAfterDebt !== null) totalCashflowAfterDebt += cashflowAfterDebt;

    // Negative cashflow tracking
    if (cashflowAfterDebt !== null && cashflowAfterDebt < 0) {
      negativeProperties.push(property.id);
      negativeTotalValue += currentValue;
    }

    // Equity
    const equity = calculateEquity(currentValue, mortgageBalance);
    if (equity !== null) totalEquity += equity;

    // LTV risk tracking
    const ltv = calculateLTV(mortgageBalance, currentValue);
    if (ltv !== null && currentValue > 0) {
      if (ltv > 85) {
        ltvAbove85.value += currentValue;
        ltvAbove85.properties.push(property.id);
      } else if (ltv > 75) {
        ltvAbove75.value += currentValue;
        ltvAbove75.properties.push(property.id);
      }
    }

    // EPC risk (exclude N/A where epc_required=false)
    if (property.epc_required !== false) {
      const rating = property.epc_rating?.toUpperCase();
      if (rating && ['D', 'E', 'F', 'G'].includes(rating)) {
        epcBelowC.push(property.id);
      }
    }

    // Pre-2000 tracking
    if (passport?.built_in_year && passport.built_in_year < 2000) {
      pre2000Count++;
    } else if (passport?.construction_date_band) {
      const band = passport.construction_date_band.toLowerCase();
      if (band.includes('pre') || band.includes('1') || band.includes('2')) {
        // Likely pre-2000 bands
        pre2000Count++;
      }
    }

    // Passport completeness
    if (passport) {
      const completeness = calculatePassportCompleteness(passport);
      passportCompletenessSum += completeness.percentage;
      passportCount++;
      
      if (completeness.criticalMissing.length > 0) {
        missingCritical.push(property.id);
      }
    } else {
      // No passport = 0% complete, critical missing
      passportCount++;
      missingCritical.push(property.id);
    }
  });

  // Calculate derived metrics
  const weightedAverageInterestRate = totalMortgageBalance > 0 
    ? weightedRateSum / totalMortgageBalance 
    : null;

  const noiMargin = totalGrossRent > 0 ? (totalNOI / totalGrossRent) * 100 : null;
  const cashflowMargin = totalGrossRent > 0 ? (totalCashflowAfterDebt / totalGrossRent) * 100 : null;

  const portfolioNetYield = totalValue > 0 ? (totalNOI / totalValue) * 100 : null;
  const portfolioROCE = totalEquity > 0 ? (totalCashflowAfterDebt / totalEquity) * 100 : null;

  const rentPerBedroomAnnual = totalBedrooms > 0 ? totalGrossRent / totalBedrooms : null;
  const rentPerBedroomMonthly = rentPerBedroomAnnual ? rentPerBedroomAnnual / 12 : null;

  // Lender concentration (top 3)
  const lenderConcentration = Array.from(lenderBalances.entries())
    .map(([lender, balance]) => ({
      lender,
      balance,
      percent: totalMortgageBalance > 0 ? (balance / totalMortgageBalance) * 100 : 0,
    }))
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 3);

  return {
    debt: {
      weightedAverageInterestRate,
      totalMortgageBalance,
      expiringIn3Months: {
        count: expiring3m.count,
        balance: expiring3m.balance,
        percent: totalMortgageBalance > 0 ? (expiring3m.balance / totalMortgageBalance) * 100 : 0,
      },
      expiringIn6Months: {
        count: expiring6m.count,
        balance: expiring6m.balance,
        percent: totalMortgageBalance > 0 ? (expiring6m.balance / totalMortgageBalance) * 100 : 0,
      },
      expiringIn12Months: {
        count: expiring12m.count,
        balance: expiring12m.balance,
        percent: totalMortgageBalance > 0 ? (expiring12m.balance / totalMortgageBalance) * 100 : 0,
      },
      lenderConcentration,
    },
    cashflow: {
      totalGrossRent,
      totalNOI,
      totalCashflowAfterDebt,
      noiMargin,
      cashflowMargin,
      negativeProperties: {
        count: negativeProperties.length,
        totalValue: negativeTotalValue,
        properties: negativeProperties,
      },
    },
    returns: {
      portfolioNetYield,
      portfolioROCE,
      rentPerBedroomMonthly,
      rentPerBedroomAnnual,
      totalBedrooms,
      totalEquity,
      totalValue,
    },
    risk: {
      ltvAbove75: {
        count: ltvAbove75.properties.length,
        value: ltvAbove75.value,
        percent: totalValue > 0 ? (ltvAbove75.value / totalValue) * 100 : 0,
        properties: ltvAbove75.properties,
      },
      ltvAbove85: {
        count: ltvAbove85.properties.length,
        value: ltvAbove85.value,
        percent: totalValue > 0 ? (ltvAbove85.value / totalValue) * 100 : 0,
        properties: ltvAbove85.properties,
      },
      epcBelowC: {
        count: epcBelowC.length,
        properties: epcBelowC,
      },
      pre2000Count,
    },
    operational: {
      averagePassportCompleteness: passportCount > 0 ? passportCompletenessSum / passportCount : 0,
      propertiesMissingCritical: {
        count: missingCritical.length,
        properties: missingCritical,
      },
    },
    propertyCount: properties.length,
  };
}

// ============================================================
// ACTION ITEMS GENERATOR
// ============================================================

export function generateActionItems(
  insights: PortfolioInsights,
  properties: PropertyWithFinancials[]
): ActionItem[] {
  const actions: ActionItem[] = [];
  const propertyMap = new Map(properties.map(p => [p.id, p.address_line]));

  // High LTV (>85%)
  if (insights.risk.ltvAbove85.count > 0) {
    actions.push({
      id: 'ltv-critical',
      severity: 'red',
      title: 'Critical LTV (>85%)',
      description: `${insights.risk.ltvAbove85.count} properties have LTV above 85%`,
      count: insights.risk.ltvAbove85.count,
      propertyIds: insights.risk.ltvAbove85.properties,
      filterType: 'ltv_above_85',
    });
  }

  // Negative cashflow
  if (insights.cashflow.negativeProperties.count > 0) {
    actions.push({
      id: 'negative-cashflow',
      severity: 'red',
      title: 'Negative Cashflow',
      description: `${insights.cashflow.negativeProperties.count} properties losing money after debt`,
      count: insights.cashflow.negativeProperties.count,
      propertyIds: insights.cashflow.negativeProperties.properties,
      filterType: 'negative_cashflow',
    });
  }

  // Rates expiring soon (3 months)
  if (insights.debt.expiringIn3Months.count > 0) {
    actions.push({
      id: 'rate-expiry-3m',
      severity: 'red',
      title: 'Rates Expiring (90 days)',
      description: `${insights.debt.expiringIn3Months.count} fixed rates expiring within 3 months`,
      count: insights.debt.expiringIn3Months.count,
      propertyIds: [],
      filterType: 'rate_expiry_3m',
    });
  }

  // Warning LTV (>75%)
  if (insights.risk.ltvAbove75.count > 0) {
    actions.push({
      id: 'ltv-warning',
      severity: 'yellow',
      title: 'Elevated LTV (>75%)',
      description: `${insights.risk.ltvAbove75.count} properties have LTV above 75%`,
      count: insights.risk.ltvAbove75.count,
      propertyIds: insights.risk.ltvAbove75.properties,
      filterType: 'ltv_above_75',
    });
  }

  // EPC below C
  if (insights.risk.epcBelowC.count > 0) {
    actions.push({
      id: 'epc-below-c',
      severity: 'yellow',
      title: 'EPC Below C Rating',
      description: `${insights.risk.epcBelowC.count} properties need EPC improvements`,
      count: insights.risk.epcBelowC.count,
      propertyIds: insights.risk.epcBelowC.properties,
      filterType: 'epc_below_c',
    });
  }

  // Missing critical ops data
  if (insights.operational.propertiesMissingCritical.count > 0) {
    actions.push({
      id: 'missing-ops',
      severity: 'yellow',
      title: 'Missing Operational Data',
      description: `${insights.operational.propertiesMissingCritical.count} properties missing critical passport fields`,
      count: insights.operational.propertiesMissingCritical.count,
      propertyIds: insights.operational.propertiesMissingCritical.properties,
      filterType: 'missing_passport',
    });
  }

  // Rates expiring 6-12 months
  if (insights.debt.expiringIn12Months.count > insights.debt.expiringIn3Months.count) {
    const count = insights.debt.expiringIn12Months.count - insights.debt.expiringIn3Months.count;
    actions.push({
      id: 'rate-expiry-12m',
      severity: 'yellow',
      title: 'Rates Expiring (12 months)',
      description: `${count} additional fixed rates expiring within 12 months`,
      count,
      propertyIds: [],
      filterType: 'rate_expiry_12m',
    });
  }

  return actions.sort((a, b) => {
    if (a.severity === 'red' && b.severity !== 'red') return -1;
    if (a.severity !== 'red' && b.severity === 'red') return 1;
    return b.count - a.count;
  });
}

// ============================================================
// AI PROMPT BUILDER
// ============================================================

export function buildAIPromptData(
  insights: PortfolioInsights,
  properties: PropertyWithFinancials[]
): string {
  const propertyNames = properties.map(p => p.address_line).join(', ');
  
  return `
PORTFOLIO DATA (use only this data, no assumptions):

Property Count: ${insights.propertyCount}
Properties: ${propertyNames}

DEBT & REFINANCE:
- Total Mortgage Balance: £${insights.debt.totalMortgageBalance.toLocaleString()}
- Weighted Average Interest Rate: ${insights.debt.weightedAverageInterestRate?.toFixed(2) || 'N/A'}%
- Expiring in 3 months: ${insights.debt.expiringIn3Months.count} loans (${insights.debt.expiringIn3Months.percent.toFixed(1)}% of balance)
- Expiring in 6 months: ${insights.debt.expiringIn6Months.count} loans (${insights.debt.expiringIn6Months.percent.toFixed(1)}% of balance)
- Expiring in 12 months: ${insights.debt.expiringIn12Months.count} loans (${insights.debt.expiringIn12Months.percent.toFixed(1)}% of balance)
- Top Lenders: ${insights.debt.lenderConcentration.map(l => `${l.lender} (${l.percent.toFixed(1)}%)`).join(', ') || 'No lenders recorded'}

CASHFLOW:
- Total Gross Rent: £${insights.cashflow.totalGrossRent.toLocaleString()}/year
- Total NOI: £${insights.cashflow.totalNOI.toLocaleString()}/year
- Total Cashflow After Debt: £${insights.cashflow.totalCashflowAfterDebt.toLocaleString()}/year
- NOI Margin: ${insights.cashflow.noiMargin?.toFixed(1) || 'N/A'}%
- Cashflow Margin: ${insights.cashflow.cashflowMargin?.toFixed(1) || 'N/A'}%
- Properties with Negative Cashflow: ${insights.cashflow.negativeProperties.count} (£${insights.cashflow.negativeProperties.totalValue.toLocaleString()} value)

RETURNS:
- Portfolio Value: £${insights.returns.totalValue.toLocaleString()}
- Portfolio Equity: £${insights.returns.totalEquity.toLocaleString()}
- Net Yield: ${insights.returns.portfolioNetYield?.toFixed(2) || 'N/A'}%
- ROCE: ${insights.returns.portfolioROCE?.toFixed(2) || 'N/A'}%
- Total Bedrooms: ${insights.returns.totalBedrooms}
- Rent per Bedroom: £${insights.returns.rentPerBedroomMonthly?.toFixed(0) || 'N/A'}/month

RISK:
- Properties with LTV >75%: ${insights.risk.ltvAbove75.count} (${insights.risk.ltvAbove75.percent.toFixed(1)}% of value)
- Properties with LTV >85%: ${insights.risk.ltvAbove85.count} (${insights.risk.ltvAbove85.percent.toFixed(1)}% of value)
- EPC Below C: ${insights.risk.epcBelowC.count} properties
- Pre-2000 Buildings: ${insights.risk.pre2000Count}

OPERATIONAL:
- Average Passport Completeness: ${insights.operational.averagePassportCompleteness.toFixed(0)}%
- Missing Critical Data: ${insights.operational.propertiesMissingCritical.count} properties
`.trim();
}
