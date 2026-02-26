import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId } from './useUserOrg';
import type {
  FinancialSnapshot,
  PortfolioMonthlySummary,
  EntityFinancialSummary,
  PropertyAnnualPerformance,
} from '@/lib/financialSnapshotTypes';

// ── Portfolio Monthly Summary ──
export function usePortfolioMonthlySummary(months = 12) {
  return useQuery({
    queryKey: ['portfolio_monthly_summary', months],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portfolio_monthly_summary' as any)
        .select('*')
        .order('snapshot_month', { ascending: false })
        .limit(months);
      if (error) throw error;
      return (data || []) as unknown as PortfolioMonthlySummary[];
    },
  });
}

// ── Entity Financial Summary ──
export function useEntityFinancialSummary(month?: string) {
  return useQuery({
    queryKey: ['entity_financial_summary', month],
    queryFn: async () => {
      let query = supabase.from('entity_financial_summary' as any).select('*');
      if (month) query = query.eq('snapshot_month', month);
      query = query.order('snapshot_month', { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as EntityFinancialSummary[];
    },
  });
}

// ── Entity Monthly Snapshots (for entity detail) ──
export function useEntityMonthlySnapshots(entityId: string | undefined, months = 12) {
  return useQuery({
    queryKey: ['entity_financial_summary_monthly', entityId, months],
    queryFn: async () => {
      if (!entityId) return [];
      const { data, error } = await supabase
        .from('entity_financial_summary' as any)
        .select('*')
        .eq('entity_id', entityId)
        .order('snapshot_month', { ascending: false })
        .limit(months);
      if (error) throw error;
      return (data || []) as unknown as EntityFinancialSummary[];
    },
    enabled: !!entityId,
  });
}

// ── Entity property breakdown for a month ──
export function useEntityPropertyBreakdown(entityId: string | undefined, month?: string) {
  return useQuery({
    queryKey: ['entity_property_breakdown', entityId, month],
    queryFn: async () => {
      if (!entityId || !month) return [];
      const { data, error } = await supabase
        .from('financial_snapshots')
        .select('property_id, gross_rent_received, total_costs, net_operating_income, net_cash_flow, mortgage_payments')
        .eq('entity_id', entityId)
        .eq('snapshot_month', month);
      if (error) throw error;
      return (data || []) as { property_id: string; gross_rent_received: number; total_costs: number; net_operating_income: number; net_cash_flow: number; mortgage_payments: number }[];
    },
    enabled: !!entityId && !!month,
  });
}

// ── Property Annual Performance ──
export function usePropertyAnnualPerformance() {
  return useQuery({
    queryKey: ['property_annual_performance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_annual_performance' as any)
        .select('*');
      if (error) throw error;
      return (data || []) as unknown as PropertyAnnualPerformance[];
    },
  });
}

// ── Property snapshots (for property detail) ──
export function usePropertySnapshots(propertyId: string | undefined, months = 12) {
  return useQuery({
    queryKey: ['financial_snapshots', propertyId, months],
    queryFn: async () => {
      if (!propertyId) return [];
      const { data, error } = await supabase
        .from('financial_snapshots')
        .select('*')
        .eq('property_id', propertyId)
        .order('snapshot_month', { ascending: false })
        .limit(months);
      if (error) throw error;
      return (data || []) as FinancialSnapshot[];
    },
    enabled: !!propertyId,
  });
}

// ── All snapshots for a given month ──
export function useMonthSnapshots(month: string | undefined) {
  return useQuery({
    queryKey: ['financial_snapshots_month', month],
    queryFn: async () => {
      if (!month) return [];
      const { data, error } = await supabase
        .from('financial_snapshots')
        .select('*')
        .eq('snapshot_month', month);
      if (error) throw error;
      return (data || []) as FinancialSnapshot[];
    },
    enabled: !!month,
  });
}

// ── Upsert snapshot ──
export function useUpsertSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (snapshot: Omit<FinancialSnapshot, 'id' | 'total_costs' | 'net_operating_income' | 'net_cash_flow' | 'rent_collection_rate' | 'created_at' | 'updated_at'>) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabase
        .from('financial_snapshots')
        .upsert(
          { ...snapshot, org_id: orgId },
          { onConflict: 'property_id,snapshot_month' }
        )
        .select()
        .single();
      if (error) throw error;
      return data as FinancialSnapshot;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial_snapshots'] });
      qc.invalidateQueries({ queryKey: ['financial_snapshots_month'] });
      qc.invalidateQueries({ queryKey: ['portfolio_monthly_summary'] });
      qc.invalidateQueries({ queryKey: ['entity_financial_summary'] });
      qc.invalidateQueries({ queryKey: ['property_annual_performance'] });
    },
  });
}

// ── Lock/unlock month ──
export function useLockMonth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ month, lock }: { month: string; lock: boolean }) => {
      const orgId = await fetchUserOrgId();
      const updates: any = { is_locked: lock };
      if (lock) {
        updates.locked_at = new Date().toISOString();
        const { data: { user } } = await supabase.auth.getUser();
        updates.locked_by = user?.id || null;
      } else {
        updates.locked_at = null;
        updates.locked_by = null;
      }
      const { error } = await supabase
        .from('financial_snapshots')
        .update(updates)
        .eq('snapshot_month', month)
        .eq('org_id', orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial_snapshots'] });
      qc.invalidateQueries({ queryKey: ['financial_snapshots_month'] });
    },
  });
}
