// ============================================
// PORTFOLIO STATISTICS CALCULATIONS
// Aggregate metrics across all properties
// ============================================

import { PropertyWithFinancials } from '@/hooks/usePropertiesCompat';
import { getPropertyMetrics, PropertyMetrics } from './propertyMetrics';

export interface PortfolioStats {
  count: number;
  
  // Totals
  totalValue: number;
  totalMortgageBalance: number;
  totalMortgagePayment: number;
  totalAnnualRent: number;
  totalEquity: number;
  totalBeds: number;
  totalNetRent: number;
  totalMonthlyCashflow: number;
  
  // Averages
  avgBeds: number;
  avgValue: number;
  avgInterestRate: number;
  avgYield: number;
  avgLTV: number;
  avgMonthlyCashflow: number;
  
  // Calculated portfolio metrics
  portfolioLTV: number;
  weightedAvgYield: number;
}

/**
 * Calculate portfolio-wide statistics from properties and their metrics
 */
export function calculatePortfolioStats(
  properties: PropertyWithFinancials[],
  metricsMap: Map<string, PropertyMetrics>
): PortfolioStats {
  const count = properties.length;
  
  if (count === 0) {
    return {
      count: 0,
      totalValue: 0,
      totalMortgageBalance: 0,
      totalMortgagePayment: 0,
      totalAnnualRent: 0,
      totalEquity: 0,
      totalBeds: 0,
      totalNetRent: 0,
      totalMonthlyCashflow: 0,
      avgBeds: 0,
      avgValue: 0,
      avgInterestRate: 0,
      avgYield: 0,
      avgLTV: 0,
      avgMonthlyCashflow: 0,
      portfolioLTV: 0,
      weightedAvgYield: 0,
    };
  }
  
  // Sum totals
  let totalValue = 0;
  let totalMortgageBalance = 0;
  let totalMortgagePayment = 0;
  let totalAnnualRent = 0;
  let totalEquity = 0;
  let totalBeds = 0;
  let totalNetRent = 0;
  let totalMonthlyCashflow = 0;
  
  // For averaging
  let valueCount = 0;
  let rateSum = 0;
  let rateCount = 0;
  let yieldSum = 0;
  let yieldCount = 0;
  let ltvSum = 0;
  let ltvCount = 0;
  let cashflowCount = 0;
  let bedsCount = 0;
  
  properties.forEach(property => {
    const metrics = metricsMap.get(property.id) || getPropertyMetrics(property);
    
    // Totals
    if (metrics.currentValue !== null) {
      totalValue += metrics.currentValue;
      valueCount++;
    }
    if (metrics.mortgageBalance !== null) {
      totalMortgageBalance += metrics.mortgageBalance;
    }
    if (metrics.mortgagePayment !== null) {
      totalMortgagePayment += metrics.mortgagePayment;
    }
    if (metrics.annualRent !== null) {
      totalAnnualRent += metrics.annualRent;
    }
    if (metrics.equity !== null) {
      totalEquity += metrics.equity;
    }
    if (property.beds !== null && property.beds !== undefined) {
      totalBeds += property.beds;
      bedsCount++;
    }
    if (metrics.netRent !== null) {
      totalNetRent += metrics.netRent;
    }
    if (metrics.monthlyCashflow !== null) {
      totalMonthlyCashflow += metrics.monthlyCashflow;
      cashflowCount++;
    }
    
    // For averages
    if (metrics.loan?.interest_rate_percent) {
      rateSum += Number(metrics.loan.interest_rate_percent);
      rateCount++;
    }
    if (metrics.yieldPercent !== null) {
      yieldSum += metrics.yieldPercent;
      yieldCount++;
    }
    if (metrics.ltv !== null) {
      ltvSum += metrics.ltv;
      ltvCount++;
    }
  });
  
  // Calculate averages
  const avgBeds = bedsCount > 0 ? totalBeds / bedsCount : 0;
  const avgValue = valueCount > 0 ? totalValue / valueCount : 0;
  const avgInterestRate = rateCount > 0 ? rateSum / rateCount : 0;
  const avgYield = yieldCount > 0 ? yieldSum / yieldCount : 0;
  const avgLTV = ltvCount > 0 ? ltvSum / ltvCount : 0;
  const avgMonthlyCashflow = cashflowCount > 0 ? totalMonthlyCashflow / cashflowCount : 0;
  
  // Portfolio-level metrics
  const portfolioLTV = totalValue > 0 ? (totalMortgageBalance / totalValue) * 100 : 0;
  const weightedAvgYield = totalValue > 0 ? (totalAnnualRent / totalValue) * 100 : 0;
  
  return {
    count,
    totalValue,
    totalMortgageBalance,
    totalMortgagePayment,
    totalAnnualRent,
    totalEquity,
    totalBeds,
    totalNetRent,
    totalMonthlyCashflow,
    avgBeds,
    avgValue,
    avgInterestRate,
    avgYield,
    avgLTV,
    avgMonthlyCashflow,
    portfolioLTV,
    weightedAvgYield,
  };
}
