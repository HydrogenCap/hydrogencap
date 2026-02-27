/**
 * Hook to extract Hydrogen Capital's attributed KPIs from portfolio attribution data.
 * 
 * Identifies the HYDROGEN CAPITAL LTD party in the ownership structure and returns
 * its ownership-attributed financial metrics for side-by-side comparison with gross figures.
 */
import { useMemo } from 'react';
import type { OwnerAttribution } from './useOwnershipAttribution';

const HYDROGEN_PARTY_NAME = 'HYDROGEN CAPITAL LTD';

export interface HydrogenKPIs {
  totalValue: number;
  totalEquity: number;
  totalDebt: number;
  totalRent: number;
  totalNOI: number;
  totalCashflow: number; // annual
  monthlyCashflow: number;
  averageLTV: number;
  propertyCount: number;
  weightedYield: number | null;
  isAvailable: boolean;
}

export function useHydrogenKPIs(attribution: OwnerAttribution[] | undefined): HydrogenKPIs {
  return useMemo(() => {
    if (!attribution || attribution.length === 0) {
      return {
        totalValue: 0, totalEquity: 0, totalDebt: 0,
        totalRent: 0, totalNOI: 0, totalCashflow: 0, monthlyCashflow: 0,
        averageLTV: 0, propertyCount: 0, weightedYield: null,
        isAvailable: false,
      };
    }

    // Find Hydrogen Capital in the attribution results
    const hydrogen = attribution.find(
      a => a.ownerName.toUpperCase().includes('HYDROGEN CAPITAL')
    );

    if (!hydrogen) {
      return {
        totalValue: 0, totalEquity: 0, totalDebt: 0,
        totalRent: 0, totalNOI: 0, totalCashflow: 0, monthlyCashflow: 0,
        averageLTV: 0, propertyCount: 0, weightedYield: null,
        isAvailable: false,
      };
    }

    const t = hydrogen.totals;
    const averageLTV = t.totalAttributableValue > 0
      ? (t.totalAttributableDebt / t.totalAttributableValue) * 100
      : 0;

    return {
      totalValue: t.totalAttributableValue,
      totalEquity: t.totalAttributableEquity,
      totalDebt: t.totalAttributableDebt,
      totalRent: t.totalAttributableRent,
      totalNOI: t.totalAttributableNOI,
      totalCashflow: t.totalAttributableCashflow,
      monthlyCashflow: t.totalAttributableCashflow / 12,
      averageLTV,
      propertyCount: t.propertyCount,
      weightedYield: t.weightedYield,
      isAvailable: true,
    };
  }, [attribution]);
}
