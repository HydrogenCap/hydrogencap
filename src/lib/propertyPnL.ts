/**
 * Property P&L Calculation Engine (AA3a)
 * Calculates per-property profit & loss from actual transaction data
 */
import { format, subMonths } from 'date-fns';

export interface MonthlyPnL {
  month: string; // 'YYYY-MM'
  grossIncome: number;
  voidLoss: number;
  mortgagePayment: number;
  insurance: number;
  maintenance: number;
  compliance: number;
  managementFees: number;
  otherCosts: number;
  noi: number;
  netCashflow: number;
}

export interface PropertyFinancials {
  propertyId: string;
  currentValuation: number;
  totalDebt: number;
  equity: number;
  ltv: number;
  annualGrossIncome: number;
  annualCosts: number;
  annualNOI: number;
  annualCashflow: number;
  grossYield: number;
  netYield: number;
  months: MonthlyPnL[];
}

interface RentPaymentRow {
  amount: number;
  payment_date: string;
}

interface LoanRow {
  current_balance: number;
  interest_rate: number;
  monthly_payment: number | null;
}

interface MaintenanceCostRow {
  paid_amount: number | null;
  paid_date: string | null;
}

interface CapexRow {
  actual_gbp: number;
  paid_date: string | null;
  created_at: string;
}

/**
 * Build an empty 12-month grid keyed by 'YYYY-MM'
 */
export function buildMonthGrid(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    months.push(format(subMonths(now, i), 'yyyy-MM'));
  }
  return months;
}

/**
 * Calculate the full property P&L from raw data
 */
export function calculatePropertyPnL(
  propertyId: string,
  currentValuation: number | null,
  expectedRentPcm: number,
  rentPayments: RentPaymentRow[],
  loans: LoanRow[],
  maintenanceCosts: MaintenanceCostRow[],
  capexItems: CapexRow[],
  managementFeePercent: number = 0,
): PropertyFinancials {
  const months = buildMonthGrid();
  const valuation = currentValuation || 0;

  // Calculate monthly mortgage cost from active loans
  const totalMonthlyMortgage = loans.reduce((sum, loan) => {
    if (loan.monthly_payment && loan.monthly_payment > 0) {
      return sum + loan.monthly_payment;
    }
    // Fallback: interest-only calc
    return sum + (loan.current_balance * loan.interest_rate / 100) / 12;
  }, 0);

  const totalDebt = loans.reduce((sum, l) => sum + l.current_balance, 0);

  // Group rent payments by month
  const incomeByMonth = new Map<string, number>();
  for (const p of rentPayments) {
    const key = p.payment_date.substring(0, 7); // 'YYYY-MM'
    incomeByMonth.set(key, (incomeByMonth.get(key) || 0) + p.amount);
  }

  // Group maintenance costs by month (from works_orders.paid_date)
  const maintenanceByMonth = new Map<string, number>();
  for (const m of maintenanceCosts) {
    if (m.paid_amount && m.paid_date) {
      const key = m.paid_date.substring(0, 7);
      maintenanceByMonth.set(key, (maintenanceByMonth.get(key) || 0) + m.paid_amount);
    }
  }

  // Group capex by month (from paid_date or created_at)
  const capexByMonth = new Map<string, number>();
  for (const c of capexItems) {
    if (c.actual_gbp > 0) {
      const dateKey = (c.paid_date || c.created_at).substring(0, 7);
      capexByMonth.set(dateKey, (capexByMonth.get(dateKey) || 0) + c.actual_gbp);
    }
  }

  // Build monthly P&L rows
  const monthlyData: MonthlyPnL[] = months.map(month => {
    const grossIncome = incomeByMonth.get(month) || 0;
    const voidLoss = Math.max(0, expectedRentPcm - grossIncome);
    const maintenance = maintenanceByMonth.get(month) || 0;
    const otherCosts = capexByMonth.get(month) || 0;
    const managementFees = managementFeePercent > 0 ? grossIncome * (managementFeePercent / 100) : 0;

    const operatingCosts = maintenance + managementFees + otherCosts;
    const noi = grossIncome - operatingCosts;
    const netCashflow = noi - totalMonthlyMortgage;

    return {
      month,
      grossIncome,
      voidLoss,
      mortgagePayment: totalMonthlyMortgage,
      insurance: 0,
      maintenance,
      compliance: 0,
      managementFees,
      otherCosts,
      noi,
      netCashflow,
    };
  });

  const annualGrossIncome = monthlyData.reduce((s, m) => s + m.grossIncome, 0);
  const annualCosts = monthlyData.reduce((s, m) => s + m.maintenance + m.managementFees + m.otherCosts + m.insurance + m.compliance, 0);
  const annualMortgage = totalMonthlyMortgage * 12;
  const annualNOI = annualGrossIncome - annualCosts;
  const annualCashflow = annualNOI - annualMortgage;

  return {
    propertyId,
    currentValuation: valuation,
    totalDebt,
    equity: valuation - totalDebt,
    ltv: valuation > 0 ? (totalDebt / valuation) * 100 : 0,
    annualGrossIncome,
    annualCosts,
    annualNOI,
    annualCashflow,
    grossYield: valuation > 0 ? (annualGrossIncome / valuation) * 100 : 0,
    netYield: valuation > 0 ? (annualNOI / valuation) * 100 : 0,
    months: monthlyData,
  };
}
