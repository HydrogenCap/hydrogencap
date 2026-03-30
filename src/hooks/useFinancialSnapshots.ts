import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { fetchUserOrgId, useUserOrg } from './useUserOrg';
import type {
  FinancialSnapshot,
  PortfolioMonthlySummary,
  EntityFinancialSummary,
  PropertyAnnualPerformance,
} from '@/lib/financialSnapshotTypes';

type FinancialSnapshotUpdate = Database['public']['Tables']['financial_snapshots']['Update'];
const PORTFOLIO_MONTHLY_SUMMARY_VIEW = 'portfolio_monthly_summary' as never;
const ENTITY_FINANCIAL_SUMMARY_VIEW = 'entity_financial_summary' as never;
const PROPERTY_ANNUAL_PERFORMANCE_VIEW = 'property_annual_performance' as never;

// ── Portfolio Monthly Summary ──
export function usePortfolioMonthlySummary(months = 12) {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['portfolio_monthly_summary', orgId, months],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(PORTFOLIO_MONTHLY_SUMMARY_VIEW)
        .select('snapshot_month, total_gross_rent, total_costs, total_noi, total_cash_flow, total_mortgage_payments, property_count, avg_collection_rate')
        .order('snapshot_month', { ascending: false })
        .limit(months);
      if (error) throw error;
      return (data || []) as unknown as PortfolioMonthlySummary[];
    },
    enabled: !!orgId,
  });
}

// ── Entity Financial Summary ──
export function useEntityFinancialSummary(month?: string) {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['entity_financial_summary', orgId, month],
    queryFn: async () => {
      let query = supabase.from(ENTITY_FINANCIAL_SUMMARY_VIEW).select('entity_id, entity_name, snapshot_month, total_gross_rent, total_costs, total_noi, total_cash_flow, total_mortgage_payments, property_count, avg_collection_rate');
      if (month) query = query.eq('snapshot_month', month);
      query = query.order('snapshot_month', { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as EntityFinancialSummary[];
    },
    enabled: !!orgId,
  });
}

// ── Entity Monthly Snapshots (for entity detail) ──
export function useEntityMonthlySnapshots(entityId: string | undefined, months = 12) {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['entity_financial_summary_monthly', orgId, entityId, months],
    queryFn: async () => {
      if (!entityId) return [];
      const { data, error } = await supabase
        .from(ENTITY_FINANCIAL_SUMMARY_VIEW)
        .select('entity_id, entity_name, snapshot_month, total_gross_rent, total_costs, total_noi, total_cash_flow, total_mortgage_payments, property_count, avg_collection_rate')
        .eq('entity_id', entityId)
        .order('snapshot_month', { ascending: false })
        .limit(months);
      if (error) throw error;
      return (data || []) as unknown as EntityFinancialSummary[];
    },
    enabled: !!orgId && !!entityId,
  });
}

// ── Entity property breakdown for a month ──
export function useEntityPropertyBreakdown(entityId: string | undefined, month?: string) {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['entity_property_breakdown', orgId, entityId, month],
    queryFn: async () => {
      if (!entityId || !month) return [];
      const { data, error } = await supabase
        .from('financial_snapshots')
        .select('property_id, gross_rent_received, total_costs, net_operating_income, net_cash_flow, mortgage_payments')
        .eq('org_id', orgId!)
        .eq('entity_id', entityId)
        .eq('snapshot_month', month);
      if (error) throw error;
      return (data || []) as { property_id: string; gross_rent_received: number; total_costs: number; net_operating_income: number; net_cash_flow: number; mortgage_payments: number }[];
    },
    enabled: !!orgId && !!entityId && !!month,
  });
}

// ── Property Annual Performance ──
export function usePropertyAnnualPerformance() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['property_annual_performance', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(PROPERTY_ANNUAL_PERFORMANCE_VIEW)
        .select('property_id, property_address, entity_id, entity_name, total_gross_rent, total_costs, total_noi, total_cash_flow, avg_collection_rate, months_active');
      if (error) throw error;
      return (data || []) as unknown as PropertyAnnualPerformance[];
    },
    enabled: !!orgId,
  });
}

// ── Property snapshots (for property detail) ──
export function usePropertySnapshots(propertyId: string | undefined, months = 12) {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['financial_snapshots', orgId, propertyId, months],
    queryFn: async () => {
      if (!propertyId) return [];
      const { data, error } = await supabase
        .from('financial_snapshots')
        .select('id, org_id, property_id, entity_id, snapshot_month, gross_rent_due, gross_rent_received, other_income, management_fees, maintenance_costs, insurance_costs, utilities, council_tax, licensing_costs, professional_fees, other_costs, mortgage_payments, total_costs, net_operating_income, net_cash_flow, rent_collection_rate, is_locked, locked_at, locked_by, created_at, updated_at')
        .eq('org_id', orgId!)
        .eq('property_id', propertyId)
        .order('snapshot_month', { ascending: false })
        .limit(months);
      if (error) throw error;
      return (data || []) as FinancialSnapshot[];
    },
    enabled: !!orgId && !!propertyId,
  });
}

// ── All snapshots for a given month ──
export function useMonthSnapshots(month: string | undefined) {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['financial_snapshots_month', orgId, month],
    queryFn: async () => {
      if (!month) return [];
      const { data, error } = await supabase
        .from('financial_snapshots')
        .select('id, org_id, property_id, entity_id, snapshot_month, gross_rent_due, gross_rent_received, other_income, management_fees, maintenance_costs, insurance_costs, utilities, council_tax, licensing_costs, professional_fees, other_costs, mortgage_payments, total_costs, net_operating_income, net_cash_flow, rent_collection_rate, is_locked, locked_at, locked_by, created_at, updated_at')
        .eq('org_id', orgId!)
        .eq('snapshot_month', month);
      if (error) throw error;
      return (data || []) as FinancialSnapshot[];
    },
    enabled: !!orgId && !!month,
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

// ── Portfolio value/debt/equity timeline (for PortfolioTimeline page) ──
export function usePortfolioValueTimeline(months = 24) {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['portfolio_value_timeline', orgId, months],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(PORTFOLIO_MONTHLY_SUMMARY_VIEW)
        .select('snapshot_month, total_valuation, total_debt, total_equity, portfolio_ltv, total_rent_received, total_noi, total_cash_flow, property_count')
        .order('snapshot_month', { ascending: true })
        .limit(months);
      if (error) throw error;
      return (data || []).map((row: any) => ({
        month: row.snapshot_month?.slice(0, 7) ?? '',
        label: new Date((row.snapshot_month ?? '').slice(0, 7) + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
        totalValuation: row.total_valuation ?? 0,
        totalDebt: row.total_debt ?? 0,
        totalEquity: row.total_equity ?? 0,
        ltv: row.portfolio_ltv,
        grossRentReceived: row.total_rent_received ?? 0,
        netCashFlow: row.total_cash_flow ?? 0,
        netOperatingIncome: row.total_noi ?? 0,
      }));
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Lock/unlock month ──
export function useLockMonth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ month, lock }: { month: string; lock: boolean }) => {
      const orgId = await fetchUserOrgId();
      const updates: FinancialSnapshotUpdate = { is_locked: lock };
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
