/**
 * Property health score system (0-100).
 */
import { daysUntil } from './risk';

export interface HealthScoreBreakdown {
  cashflow: number;
  leverage: number;
  risk: number;
  compliance: number;
  total: number;
}

export interface PropertyHealthInputs {
  annualRent: number | null;
  totalCosts: number;
  mortgagePayment: number | null;

  ltv: number | null;

  fixedRateExpires: string | null;
  isInterestOnly: boolean;

  epcRating: string | null;
  epcRequired?: boolean;
  hasGasSafety?: boolean;
  hasEICR?: boolean;
}

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
    leverageScore = 25;
  }

  let riskScore = 25;

  if (fixedRateExpires) {
    const days = daysUntil(fixedRateExpires);
    if (days !== null) {
      if (days <= 0) riskScore -= 15;
      else if (days <= 30) riskScore -= 12;
      else if (days <= 60) riskScore -= 8;
      else if (days <= 90) riskScore -= 4;
    }
  }

  if (isInterestOnly) {
    riskScore -= 5;
  }

  riskScore = Math.max(0, riskScore);

  let complianceScore = 25;
  const epcRequired = inputs.epcRequired !== false;

  if (epcRequired) {
    if (epcRating) {
      const rating = epcRating.toUpperCase();
      if (rating === 'N/A') {
        complianceScore -= 10;
      } else if (rating === 'F' || rating === 'G') {
        complianceScore -= 15;
      } else if (rating === 'E') {
        complianceScore -= 10;
      } else if (rating === 'D') {
        complianceScore -= 5;
      }
    } else {
      complianceScore -= 10;
    }
  }

  if (inputs.hasGasSafety === false) {
    complianceScore -= 15;
  }
  if (inputs.hasEICR === false) {
    complianceScore -= 10;
  }

  complianceScore = Math.max(0, complianceScore);

  const total = cashflowScore + leverageScore + riskScore + complianceScore;

  return {
    cashflow: cashflowScore,
    leverage: leverageScore,
    risk: riskScore,
    compliance: complianceScore,
    total,
  };
}

export function getHealthGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export function getHealthStatus(grade: 'A' | 'B' | 'C' | 'D' | 'F'): 'success' | 'warning' | 'danger' {
  if (grade === 'A' || grade === 'B') return 'success';
  if (grade === 'C') return 'warning';
  return 'danger';
}
