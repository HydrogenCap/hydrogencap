/**
 * V2 Portfolio KPIs hook — computes both gross and attributable metrics.
 * Replaces the 60-line portfolioStats useMemo in Dashboard.tsx.
 */
import { useMemo } from 'react';
import { usePropertiesV2 } from './usePropertiesV2';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOwnershipData } from './useOwnershipData';
import { getGroupParentOwnership } from '@/lib/ownershipEngine';

// ─── Types ───────────────────────────────────────────────────────────────

export interface PortfolioMetrics {
  totalValue: number;
  totalDebt: number;
  totalEquity: number;
  weightedLTV: number;
  annualRent: number;
  annualCosts: number;
  annualMortgagePayments: number;
  annualNOI: number;
  annualCashflow: number;
  monthlyCashflow: number;
  netYieldPct: number | null;
  dscr: number | null;
  propertyCount: number;
}

export interface DualPortfolioKPIs {
  gross: PortfolioMetrics;
  attributable: PortfolioMetrics;
  groupParentName: string;
  groupParentEntityId: string | null;
  properties: PropertyKPIRow[];
}

export interface PropertyKPIRow {
  propertyId: string;
  address: string;
  city: string;
  entityId: string;
  entityName: string;
  value: number;
  debt: number;
  equity: number;
  annualRent: number;
  annualCashflow: number;
  ltv: number;
  groupOwnershipPct: number;
  attrValue: number;
  attrDebt: number;
  attrEquity: number;
  attrRent: number;
  attrCashflow: number;
}

// ─── Data Fetchers ───────────────────────────────────────────────────────

function useLoanFacilities() {
  return useQuery({
    queryKey: ['loan_facilities_all'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('loan_facilities')
        .select('id, property_id, entity_id, current_balance, monthly_payment, interest_rate, lender_id, status')
        .in('status', ['active', 'drawdown']);
      if (error) throw error;
      return data || [];
    },
  });
}

function useAnnualPerformanceV2() {
  return useQuery({
    queryKey: ['property_annual_performance_v2'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('property_annual_performance')
        .select('*');
      if (error) throw error;
      return data || [];
    },
  });
}

// ─── Main Hook ───────────────────────────────────────────────────────────

export function usePortfolioKPIs(): {
  data: DualPortfolioKPIs | null;
  isLoading: boolean;
} {
  const { data: properties, isLoading: propsLoading } = usePropertiesV2();
  const { data: loans, isLoading: loansLoading } = useLoanFacilities();
  const { data: performance, isLoading: perfLoading } = useAnnualPerformanceV2();
  const { data: ownershipData, isLoading: ownershipLoading } = useOwnershipData();

  const isLoading = propsLoading || loansLoading || perfLoading || ownershipLoading;

  const data = useMemo(() => {
    if (!properties?.length || !ownershipData) return null;

    const { entities, shareClasses, shareholders } = ownershipData;
    const now = new Date();

    const groupParent = entities.find(e => e.is_group_parent);

    // Build lookup maps
    const loansByProperty = new Map<string, typeof loans>();
    for (const loan of (loans || [])) {
      const existing = loansByProperty.get(loan.property_id) || [];
      existing.push(loan);
      loansByProperty.set(loan.property_id, existing);
    }

    type PerfRow = NonNullable<typeof performance>[number];
    const perfByProperty = new Map<string, PerfRow>();
    for (const p of (performance || [])) {
      if (p.property_id) perfByProperty.set(p.property_id, p);
    }

    // Core rental properties only
    const coreProperties = properties.filter(
      p => ['stabilised', 'letting'].includes(p.lifecycle_stage)
    );

    // Calculate per-property rows
    const propertyRows: PropertyKPIRow[] = coreProperties.map(prop => {
      const propertyLoans = loansByProperty.get(prop.id) || [];
      const perf = perfByProperty.get(prop.id);

      const value = prop.current_valuation || 0;
      const debt = propertyLoans.reduce((sum, l) => sum + (l.current_balance || 0), 0);
      const equity = value - debt;
      const ltv = value > 0 ? (debt / value) * 100 : 0;

      const annualRent = perf?.annual_rent_received || 0;
      const annualCashflow = perf?.annual_cash_flow || 0;

      let groupOwnershipPct = 0;
      if (groupParent) {
        const result = getGroupParentOwnership(
          prop.entity_id, entities, shareClasses, shareholders, now
        );
        groupOwnershipPct = result.ownershipPercent;
      }

      const factor = groupOwnershipPct / 100;

      return {
        propertyId: prop.id,
        address: prop.address_line_1,
        city: prop.city,
        entityId: prop.entity_id,
        entityName: prop.entity_name,
        value,
        debt,
        equity,
        annualRent,
        annualCashflow,
        ltv,
        groupOwnershipPct,
        attrValue: value * factor,
        attrDebt: debt * factor,
        attrEquity: equity * factor,
        attrRent: annualRent * factor,
        attrCashflow: annualCashflow * factor,
      };
    });

    // Aggregate gross
    const gross: PortfolioMetrics = {
      totalValue: 0, totalDebt: 0, totalEquity: 0, weightedLTV: 0,
      annualRent: 0, annualCosts: 0, annualMortgagePayments: 0,
      annualNOI: 0, annualCashflow: 0, monthlyCashflow: 0,
      netYieldPct: null, dscr: null, propertyCount: propertyRows.length,
    };

    const attributable: PortfolioMetrics = { ...gross };

    for (const row of propertyRows) {
      const perf = perfByProperty.get(row.propertyId);

      gross.totalValue += row.value;
      gross.totalDebt += row.debt;
      gross.totalEquity += row.equity;
      gross.annualRent += row.annualRent;
      gross.annualCosts += perf?.annual_costs || 0;
      gross.annualMortgagePayments += perf?.annual_mortgage_payments || 0;
      gross.annualNOI += perf?.annual_noi || 0;
      gross.annualCashflow += row.annualCashflow;

      const factor = row.groupOwnershipPct / 100;
      attributable.totalValue += row.attrValue;
      attributable.totalDebt += row.attrDebt;
      attributable.totalEquity += row.attrEquity;
      attributable.annualRent += row.annualRent * factor;
      attributable.annualCosts += (perf?.annual_costs || 0) * factor;
      attributable.annualMortgagePayments += (perf?.annual_mortgage_payments || 0) * factor;
      attributable.annualNOI += (perf?.annual_noi || 0) * factor;
      attributable.annualCashflow += row.attrCashflow;
    }

    // Derived metrics
    gross.monthlyCashflow = gross.annualCashflow / 12;
    gross.weightedLTV = gross.totalValue > 0 ? (gross.totalDebt / gross.totalValue) * 100 : 0;
    gross.netYieldPct = gross.totalValue > 0 ? (gross.annualNOI / gross.totalValue) * 100 : null;
    gross.dscr = gross.annualMortgagePayments > 0 ? gross.annualNOI / gross.annualMortgagePayments : null;

    attributable.monthlyCashflow = attributable.annualCashflow / 12;
    attributable.weightedLTV = attributable.totalValue > 0
      ? (attributable.totalDebt / attributable.totalValue) * 100 : 0;
    attributable.netYieldPct = attributable.totalValue > 0
      ? (attributable.annualNOI / attributable.totalValue) * 100 : null;
    attributable.dscr = attributable.annualMortgagePayments > 0
      ? attributable.annualNOI / attributable.annualMortgagePayments : null;
    attributable.propertyCount = propertyRows.filter(r => r.groupOwnershipPct > 0).length;

    return {
      gross,
      attributable,
      groupParentName: groupParent?.entity_name || 'No group parent set',
      groupParentEntityId: groupParent?.id || null,
      properties: propertyRows,
    };
  }, [properties, loans, performance, ownershipData]);

  return { data, isLoading };
}
