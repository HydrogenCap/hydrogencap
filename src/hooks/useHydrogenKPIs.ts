/**
 * Hook to extract the principal party's attributed KPIs from portfolio attribution data.
 * 
 * Uses the `is_principal` flag on the parties table to identify the org's own identity
 * (e.g. Hydrogen Capital) and returns its ownership-attributed financial metrics.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { OwnerAttribution } from './useOwnershipAttribution';

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
  principalName: string | null;
}

/** Fetch the principal party for the current user's org */
export function usePrincipalParty() {
  return useQuery({
    queryKey: ['principal_party'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parties')
        .select('id, display_name, party_type')
        .eq('is_principal', true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}

export function useHydrogenKPIs(attribution: OwnerAttribution[] | undefined): HydrogenKPIs {
  const { data: principalParty } = usePrincipalParty();

  return useMemo(() => {
    const empty: HydrogenKPIs = {
      totalValue: 0, totalEquity: 0, totalDebt: 0,
      totalRent: 0, totalNOI: 0, totalCashflow: 0, monthlyCashflow: 0,
      averageLTV: 0, propertyCount: 0, weightedYield: null,
      isAvailable: false, principalName: null,
    };

    if (!attribution || attribution.length === 0 || !principalParty) {
      return empty;
    }

    // Match by party ID (is_principal flag), with name fallback for robustness
    const principal = attribution.find(
      a => a.ownerId === principalParty.id
    ) ?? attribution.find(
      a => a.ownerName.toUpperCase().includes('HYDROGEN CAPITAL')
    );

    if (!principal) {
      return { ...empty, principalName: principalParty.display_name };
    }

    const t = principal.totals;
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
      principalName: principalParty.display_name,
    };
  }, [attribution, principalParty]);
}
