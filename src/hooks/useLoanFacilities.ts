import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { fetchUserOrgId, useUserOrg } from './useUserOrg';
import { showMutationError } from '@/lib/errorToast';

export interface LoanFacility {
  id: string;
  org_id: string;
  property_id: string;
  lender_id: string;
  entity_id: string;
  facility_type: string;
  original_amount: number;
  current_balance: number;
  rate_type: string;
  interest_rate: number;
  rate_expiry_date: string | null;
  revert_rate: number | null;
  monthly_payment: number | null;
  term_start_date: string;
  term_end_date: string;
  early_repayment_charge_until: string | null;
  erc_percentage: number | null;
  ltv_at_drawdown: number | null;
  current_ltv: number | null;
  interest_only: boolean;
  repayment_type: string;
  arrangement_fee: number | null;
  valuation_fee: number | null;
  legal_fee: number | null;
  total_setup_costs: number | null;
  covenant_ltv_max: number | null;
  covenant_icr_min: number | null;
  product_name: string | null;
  account_reference: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoanFacilityWithDetails extends LoanFacility {
  lender_name: string;
  lender_type: string;
  property_address: string;
  entity_name: string;
}

export interface LoanAlert {
  loan_id: string;
  org_id: string;
  property_id: string;
  property_address: string;
  lender_name: string;
  facility_type: string;
  current_balance: number;
  interest_rate: number;
  rate_type: string;
  rate_expiry_date: string | null;
  revert_rate: number | null;
  term_end_date: string;
  early_repayment_charge_until: string | null;
  current_ltv: number | null;
  covenant_ltv_max: number | null;
  covenant_icr_min: number | null;
  rate_alert: string | null;
  term_alert: string | null;
  erc_alert: string | null;
  ltv_covenant_alert: string | null;
  days_to_rate_expiry: number | null;
  days_to_term_end: number;
  days_to_erc_end: number | null;
}

export interface PortfolioDebtSummary {
  lender_id: string;
  org_id: string;
  lender_name: string;
  lender_type: string;
  facility_count: number;
  total_exposure: number;
  total_monthly_payments: number;
  avg_interest_rate: number;
  fixed_count: number;
  variable_count: number;
  fixed_balance: number;
  variable_balance: number;
  nearest_term_end: string | null;
  nearest_rate_expiry: string | null;
}

type LenderDetails = Pick<
  Database['public']['Tables']['lenders']['Row'],
  'lender_name' | 'lender_type'
>;

type LegalEntityDetails = Pick<
  Database['public']['Tables']['legal_entities']['Row'],
  'entity_name'
>;

type PropertyDetails = Pick<
  Database['public']['Tables']['properties_v2']['Row'],
  'address_line_1' | 'postcode'
>;

interface LoanFacilityRow extends LoanFacility {
  lenders: LenderDetails | null;
  legal_entities: LegalEntityDetails | null;
}

interface LoanFacilityWithPropertyRow extends LoanFacilityRow {
  properties_v2: PropertyDetails | null;
}

export const FACILITY_TYPES = [
  { value: 'term_mortgage', label: 'Term Mortgage', color: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' },
  { value: 'bridging', label: 'Bridging', color: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800' },
  { value: 'development_finance', label: 'Development', color: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800' },
  { value: 'mezzanine', label: 'Mezzanine', color: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' },
  { value: 'overdraft', label: 'Overdraft', color: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-800' },
  { value: 'directors_loan', label: 'Directors Loan', color: 'bg-teal-100 text-teal-700 border-teal-300 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800' },
  { value: 'second_charge', label: '2nd Charge', color: 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800' },
] as const;

export const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  redeemed: 'bg-muted text-muted-foreground',
  in_arrears: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  default: 'bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-400',
  pending_drawdown: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  expired_product: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

export const RATE_TYPES = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'variable', label: 'Variable' },
  { value: 'tracker', label: 'Tracker' },
  { value: 'discount', label: 'Discount' },
] as const;

export const REPAYMENT_TYPES = [
  { value: 'interest_only', label: 'Interest Only' },
  { value: 'repayment', label: 'Repayment' },
  { value: 'part_and_part', label: 'Part & Part' },
  { value: 'rolled_up', label: 'Rolled Up' },
] as const;

type LoanFacilityJoinRow = Database['public']['Tables']['loan_facilities']['Row'] & {
  lenders: { lender_name: string; lender_type: string } | null;
  legal_entities: { entity_name: string } | null;
  property_address?: string;
};

export function useLoanFacilitiesByProperty(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['loan_facilities', 'property', propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('loan_facilities')
        .select(`
          *,
          lenders!inner(lender_name, lender_type),
          legal_entities!inner(entity_name)
        `)
        .eq('property_id', propertyId!)
        .order('status')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data || []) as LoanFacilityJoinRow[]).map((d) => ({
        ...d,
        lender_name: d.lenders?.lender_name,
        lender_type: d.lenders?.lender_type,
        entity_name: d.legal_entities?.entity_name,
        property_address: d.property_address ?? '',
      })) as LoanFacilityWithDetails[];
    },
  });
}

export function useAllLoanFacilities() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['loan_facilities', 'all', orgId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('loan_facilities')
        .select(`
          *,
          lenders!inner(lender_name, lender_type),
          legal_entities!inner(entity_name),
          properties_v2!inner(address_line_1, postcode)
        `)
        .eq('org_id', orgId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data || []) as LoanFacilityWithPropertyRow[]).map((d) => ({
        ...d,
        lender_name: d.lenders?.lender_name,
        lender_type: d.lenders?.lender_type,
        entity_name: d.legal_entities?.entity_name,
        property_address: `${d.properties_v2?.address_line_1}, ${d.properties_v2?.postcode}`,
      })) as LoanFacilityWithDetails[];
    },
    enabled: !!orgId,
  });
}

export function useLoanAlerts() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['loan_alerts', orgId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('loan_alerts')
        .select('*')
        .eq('org_id', orgId!);
      if (error) throw error;
      return data as LoanAlert[];
    },
    enabled: !!orgId,
  });
}

export function usePortfolioDebtSummary() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['portfolio_debt_summary', orgId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('portfolio_debt_summary')
        .select('*')
        .eq('org_id', orgId!);
      if (error) throw error;
      return data as PortfolioDebtSummary[];
    },
    enabled: !!orgId,
  });
}

export function useCreateLoanFacility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (facility: Omit<LoanFacility, 'id' | 'org_id' | 'created_at' | 'updated_at'>) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabaseAny
        .from('loan_facilities')
        .insert({ ...facility, org_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loan_facilities'] });
      qc.invalidateQueries({ queryKey: ['loan_alerts'] });
      qc.invalidateQueries({ queryKey: ['portfolio_debt_summary'] });
    },
    onError: (error) => {
      showMutationError(error, 'Failed to create loan facility');
    },
  });
}

export function useUpdateLoanFacility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LoanFacility> & { id: string }) => {
      const { data, error } = await supabaseAny
        .from('loan_facilities')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as LoanFacility;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['loan_facilities', 'property', data.property_id] });
      qc.invalidateQueries({ queryKey: ['loan_facilities', 'all'] });
      qc.invalidateQueries({ queryKey: ['loan_alerts'] });
      qc.invalidateQueries({ queryKey: ['portfolio_debt_summary'] });
    },
    onError: (error) => {
      showMutationError(error, 'Failed to update loan facility');
    },
  });
}

export function useDeleteLoanFacility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('loan_facilities').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loan_facilities'] });
      qc.invalidateQueries({ queryKey: ['loan_alerts'] });
      qc.invalidateQueries({ queryKey: ['portfolio_debt_summary'] });
    },
    onError: (error) => {
      showMutationError(error, 'Failed to delete loan facility');
    },
  });
}

// Helpers
export function getCovenantStatus(
  facility: LoanFacility,
): 'breach' | 'warning' | 'ok' | 'unknown' {
  const hasCovenants = facility.covenant_ltv_max || facility.covenant_icr_min;
  if (facility.covenant_ltv_max != null && facility.current_ltv != null) {
    if (facility.current_ltv > facility.covenant_ltv_max) return 'breach';
    if (facility.current_ltv > facility.covenant_ltv_max * 0.9) return 'warning';
  }
  if (facility.early_repayment_charge_until) {
    const msToErc =
      new Date(facility.early_repayment_charge_until).getTime() - Date.now();
    const daysToErc = Math.ceil(msToErc / 86_400_000);
    if (daysToErc > 0 && daysToErc <= 90) return 'warning';
  }
  if (hasCovenants) return 'ok';
  return 'unknown';
}

export function getLtvColor(ltv: number | null): string {
  if (ltv == null) return '';
  if (ltv < 65) return 'text-emerald-600';
  if (ltv < 75) return 'text-amber-600';
  return 'text-red-600';
}

export function getLtvBgColor(ltv: number | null): string {
  if (ltv == null) return '';
  if (ltv < 65) return 'bg-emerald-100 text-emerald-700';
  if (ltv < 75) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

export function getFacilityTypeInfo(type: string) {
  return FACILITY_TYPES.find(f => f.value === type) || { value: type, label: type, color: 'bg-gray-100 text-gray-700 border-gray-300' };
}

export function getFacilityBorderColor(type: string): string {
  const map: Record<string, string> = {
    term_mortgage: 'border-l-blue-500',
    bridging: 'border-l-orange-500',
    development_finance: 'border-l-purple-500',
    mezzanine: 'border-l-red-500',
    overdraft: 'border-l-slate-500',
    directors_loan: 'border-l-teal-500',
    second_charge: 'border-l-indigo-500',
  };
  return map[type] || 'border-l-gray-500';
}

export function fmtGBP(v: number | null): string {
  if (v == null) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

export function fmtGBPCompact(v: number | null): string {
  if (v == null) return '—';
  if (Math.abs(v) >= 1_000_000) return `£${(v / 1_000_000).toFixed(2)}m`;
  if (Math.abs(v) >= 1_000) return `£${(v / 1_000).toFixed(0)}k`;
  return fmtGBP(v);
}

export function fmtDate(d: string | null): string {
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d));
  } catch { return d; }
}

export function daysColor(days: number | null, thresholds: { green: number; amber: number }): string {
  if (days == null) return 'text-muted-foreground';
  if (days <= 0) return 'text-red-600';
  if (days < thresholds.amber) return 'text-red-600';
  if (days < thresholds.green) return 'text-amber-600';
  return 'text-emerald-600';
}
