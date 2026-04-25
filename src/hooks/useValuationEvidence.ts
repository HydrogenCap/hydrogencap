import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { useUserOrg, fetchUserOrgId } from './useUserOrg';
import { showMutationError, showMutationSuccess } from '@/lib/errorToast';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ValuationComparable {
  id: string;
  property_id: string;
  org_id: string;
  comp_address: string;
  comp_postcode: string | null;
  sale_price: number;
  sale_date: string;
  property_type: string | null;
  beds: number | null;
  sqm: number | null;
  price_per_sqm: number | null;
  distance_miles: number | null;
  source: 'land_registry' | 'rightmove' | 'agent' | 'manual';
  notes: string | null;
  created_at: string;
}

export type ValuationComparableInsert = Omit<ValuationComparable, 'id' | 'org_id' | 'created_at'>;

export interface ValuationHistoryRecord {
  id: string;
  property_id: string;
  org_id: string;
  valuation_date: string;
  value: number;
  basis_of_value: 'market_value' | 'investment_value' | 'fair_value';
  valuer_name: string | null;
  valuer_firm: string | null;
  valuation_type: 'desktop' | 'drive_by' | 'full_inspection' | 'rics_red_book';
  key_assumptions: string | null;
  esg_considerations: string | null;
  document_url: string | null;
  created_at: string;
}

export type ValuationHistoryInsert = Omit<ValuationHistoryRecord, 'id' | 'org_id' | 'created_at'>;

export interface RevaluationTriggerItem {
  property_id: string;
  address: string;
  postcode: string;
  current_valuation: number | null;
  last_valuation_date: string | null;
  purchase_price: number | null;
  reason: string;
  severity: 'high' | 'medium' | 'low';
}

// ── Comparables ──────────────────────────────────────────────────────────────

export function useValuationComparables(propertyId: string | undefined) {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['valuation_comparables', propertyId, orgId],
    enabled: !!propertyId && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('valuation_comparables')
        .select('*')
        .eq('property_id', propertyId!)
        .eq('org_id', orgId!)
        .order('sale_date', { ascending: false });
      if (error) throw error;
      return (data || []) as ValuationComparable[];
    },
  });
}

export function useCreateValuationComparable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ValuationComparableInsert) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabaseAny
        .from('valuation_comparables')
        .insert({ ...input, org_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return data as ValuationComparable;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['valuation_comparables', data.property_id] });
      showMutationSuccess('Comparable added');
    },
    onError: (err) => showMutationError(err, 'Failed to add comparable'),
  });
}

export function useUpdateValuationComparable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ValuationComparable> & { id: string }) => {
      const { data, error } = await supabaseAny
        .from('valuation_comparables')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ValuationComparable;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['valuation_comparables', data.property_id] });
      showMutationSuccess('Comparable updated');
    },
    onError: (err) => showMutationError(err, 'Failed to update comparable'),
  });
}

export function useDeleteValuationComparable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, propertyId }: { id: string; propertyId: string }) => {
      const { error } = await supabaseAny
        .from('valuation_comparables')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return propertyId;
    },
    onSuccess: (propertyId) => {
      qc.invalidateQueries({ queryKey: ['valuation_comparables', propertyId] });
      showMutationSuccess('Comparable removed');
    },
    onError: (err) => showMutationError(err, 'Failed to remove comparable'),
  });
}

// ── Valuation History ────────────────────────────────────────────────────────

export function useValuationHistory(propertyId: string | undefined) {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['valuation_history', propertyId, orgId],
    enabled: !!propertyId && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('valuation_history')
        .select('*')
        .eq('property_id', propertyId!)
        .eq('org_id', orgId!)
        .order('valuation_date', { ascending: true });
      if (error) throw error;
      return (data || []) as ValuationHistoryRecord[];
    },
  });
}

export function useCreateValuationHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ValuationHistoryInsert) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabaseAny
        .from('valuation_history')
        .insert({ ...input, org_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return data as ValuationHistoryRecord;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['valuation_history', data.property_id] });
      showMutationSuccess('Valuation recorded');
    },
    onError: (err) => showMutationError(err, 'Failed to record valuation'),
  });
}

export function useDeleteValuationHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, propertyId }: { id: string; propertyId: string }) => {
      const { error } = await supabaseAny
        .from('valuation_history')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return propertyId;
    },
    onSuccess: (propertyId) => {
      qc.invalidateQueries({ queryKey: ['valuation_history', propertyId] });
      showMutationSuccess('Valuation removed');
    },
    onError: (err) => showMutationError(err, 'Failed to remove valuation'),
  });
}

// ── Revaluation Triggers ────────────────────────────────────────────────────

export function useRevaluationTriggers() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['revaluation_triggers', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      // Fetch all properties with their latest valuation history
      const { data: properties, error: propErr } = await supabaseAny
        .from('properties_v2')
        .select('id, address_line_1, postcode, current_valuation, valuation_date, purchase_price')
        .eq('org_id', orgId!);
      if (propErr) throw propErr;

      const triggers: RevaluationTriggerItem[] = [];
      const now = new Date();
      const twelveMonthsAgo = new Date(now);
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      for (const p of properties || []) {
        const valDate = p.valuation_date ? new Date(p.valuation_date) : null;

        // 1. Last valuation >12 months ago
        if (!valDate || valDate < twelveMonthsAgo) {
          triggers.push({
            property_id: p.id,
            address: p.address_line_1,
            postcode: p.postcode,
            current_valuation: p.current_valuation,
            last_valuation_date: p.valuation_date,
            purchase_price: p.purchase_price,
            reason: valDate ? 'Last valuation over 12 months ago' : 'No valuation on record',
            severity: !valDate ? 'high' : 'medium',
          });
          continue; // Only one trigger per property
        }

        // 2. No current valuation set
        if (!p.current_valuation) {
          triggers.push({
            property_id: p.id,
            address: p.address_line_1,
            postcode: p.postcode,
            current_valuation: null,
            last_valuation_date: p.valuation_date,
            purchase_price: p.purchase_price,
            reason: 'No valuation recorded',
            severity: 'high',
          });
        }
      }

      return triggers;
    },
    staleTime: 5 * 60 * 1000,
  });
}
