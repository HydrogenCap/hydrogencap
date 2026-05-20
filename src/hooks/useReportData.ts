/**
 * useReportData — Shared data source for ALL portfolio reports (PDF, on-screen, bank pack).
 *
 * The goal is "single source of truth" parity: whatever a user sees in the dashboard
 * must match the bank presentation PDF and any portfolio export, so we never drift.
 *
 * Existing report generators (bankPresentationGenerator, reportPdfGenerator,
 * mortgageBrokerPackGenerator, investorReportGenerator) should migrate to consume
 * the shape returned here instead of querying Supabase directly. New reports MUST
 * use this hook.
 */
import { useMemo } from 'react';
import { usePropertiesV2 } from './usePropertiesV2';
import { usePropertyRoomSummaries } from './useRoomsV2';
import { useLegalEntities } from './useLegalEntities';
import { usePortfolioKPIs } from './usePortfolioKPIs';
import { useAllLoanFacilities } from './useLoanFacilities';

export interface ReportDataset {
  generatedAt: Date;
  properties: ReturnType<typeof usePropertiesV2>['data'];
  entities: ReturnType<typeof useLegalEntities>['data'];
  loans: ReturnType<typeof useLoanFacilities>['data'];
  kpis: ReturnType<typeof usePortfolioKPIs>['data'];
  totals: {
    propertyCount: number;
    totalValuation: number;
    totalMortgage: number;
    netEquity: number;
    monthlyGrossRent: number;
    portfolioLTV: number | null;
  };
  isLoading: boolean;
  error: Error | null;
}

export function useReportData(): ReportDataset {
  const properties = usePropertiesV2();
  const entities = useLegalEntities();
  const loans = useLoanFacilities();
  const kpis = usePortfolioKPIs();
  const roomSummaries = usePropertyRoomSummaries();

  const totals = useMemo(() => {
    const props = properties.data ?? [];
    const loanRows = loans.data ?? [];
    const totalValuation = props.reduce((s, p) => s + (p.current_valuation || 0), 0);
    const totalMortgage = loanRows.reduce((s, l: any) => s + (l.current_balance || l.principal_amount || 0), 0);
    const monthlyGrossRent = props.reduce((s, p) => {
      if (p.rent_basis === 'whole_house') return s + (p.whole_house_rent_pcm || 0);
      return s + (roomSummaries.data?.get(p.id)?.gross_rent_pcm || 0);
    }, 0);
    return {
      propertyCount: props.length,
      totalValuation,
      totalMortgage,
      netEquity: totalValuation - totalMortgage,
      monthlyGrossRent,
      portfolioLTV: totalValuation > 0 ? (totalMortgage / totalValuation) * 100 : null,
    };
  }, [properties.data, loans.data, roomSummaries.data]);

  return {
    generatedAt: new Date(),
    properties: properties.data,
    entities: entities.data,
    loans: loans.data,
    kpis: kpis.data,
    totals,
    isLoading:
      properties.isLoading ||
      entities.isLoading ||
      loans.isLoading ||
      kpis.isLoading ||
      roomSummaries.isLoading,
    error:
      (properties.error as Error | null) ||
      (entities.error as Error | null) ||
      (loans.error as Error | null) ||
      (kpis.error as Error | null) ||
      null,
  };
}
