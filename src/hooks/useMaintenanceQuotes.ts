import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId as getUserOrgId } from './useUserOrg';
import { toast } from "sonner";

export interface MaintenanceQuote {
  id: string;
  org_id: string;
  maintenance_request_id: string;
  contractor_id: string | null;
  contractor_name: string | null;
  amount: number;
  description: string | null;
  estimated_days: number | null;
  valid_until: string | null;
  status: string; // pending | accepted | rejected | expired
  quote_document_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  contractor?: {
    id: string;
    company_name: string;
    contact_name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
}

type MaintenanceQuoteInsert = {
  maintenance_request_id: string;
  contractor_id?: string | null;
  contractor_name?: string | null;
  amount: number;
  description?: string | null;
  estimated_days?: number | null;
  valid_until?: string | null;
  quote_document_path?: string | null;
  notes?: string | null;
};

interface MaintenanceRequestApprovalUpdate {
  estimated_cost: number;
  status: 'approved';
}

const MAINTENANCE_QUOTES_TABLE = 'maintenance_quotes' as const;
const QUOTE_SELECT = `
  *,
  contractor:compliance_contractors(id, company_name, contact_name, phone, email)
`;

export function useMaintenanceQuotes(requestId: string | undefined) {
  return useQuery({
    queryKey: ['maintenance_quotes', requestId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from(MAINTENANCE_QUOTES_TABLE)
        .select(QUOTE_SELECT)
        .eq('maintenance_request_id', requestId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as MaintenanceQuote[];
    },
    enabled: !!requestId,
  });
}

export function useCreateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (quote: MaintenanceQuoteInsert) => {
      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');

      const { data, error } = await supabaseAny
        .from(MAINTENANCE_QUOTES_TABLE)
        .insert([{ ...quote, org_id: orgId, status: 'pending' }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance_quotes', vars.maintenance_request_id] });
      toast.success('Quote added');
    },
    onError: (error) => {
      toast.error('Failed to add quote', { description: error.message });
    },
  });
}

export function useUpdateQuoteStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      quoteId,
      requestId,
      status,
      amount,
    }: {
      quoteId: string;
      requestId: string;
      status: 'accepted' | 'rejected';
      amount?: number;
    }) => {
      const { error } = await supabaseAny
        .from(MAINTENANCE_QUOTES_TABLE)
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', quoteId);
      if (error) throw error;

      // If accepted: reject all others, update estimated cost, set status to approved
      if (status === 'accepted') {
        await supabaseAny
          .from(MAINTENANCE_QUOTES_TABLE)
          .update({ status: 'rejected', updated_at: new Date().toISOString() })
          .eq('maintenance_request_id', requestId)
          .neq('id', quoteId);

        if (amount) {
          const updates: MaintenanceRequestApprovalUpdate = { estimated_cost: amount, status: 'approved' };
          await supabaseAny
            .from('maintenance_requests')
            .update(updates)
            .eq('id', requestId);
        }
      }

      return { quoteId, requestId, status };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance_quotes', result.requestId] });
      queryClient.invalidateQueries({ queryKey: ['maintenance_requests'] });
      toast.success(result.status === 'accepted' ? 'Quote accepted' : 'Quote rejected');
    },
    onError: (error) => {
      toast.error('Failed to update quote', { description: error.message });
    },
  });
}

export function useSuggestedContractors(category: string | undefined) {
  return useQuery({
    queryKey: ['suggested_contractors', category],
    queryFn: async () => {
      const orgId = await getUserOrgId();
      if (!orgId) return [];

      const { data, error } = await supabaseAny
        .from('compliance_contractors')
        .select('id, company_name, contact_name, phone, email, service_types, rating')
        .eq('org_id', orgId)
        .contains('service_types', [category!]);
      if (error) throw error;
      return data || [];
    },
    enabled: !!category,
  });
}
