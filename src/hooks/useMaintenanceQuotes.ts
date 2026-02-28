import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId as getUserOrgId } from './useUserOrg';
import { useToast } from '@/hooks/use-toast';

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

const QUOTE_SELECT = `
  *,
  contractor:compliance_contractors_v2(id, company_name, contact_name, phone, email)
`;

export function useMaintenanceQuotes(requestId: string | undefined) {
  return useQuery({
    queryKey: ['maintenance_quotes', requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_quotes' as any)
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
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (quote: {
      maintenance_request_id: string;
      contractor_id?: string | null;
      contractor_name?: string | null;
      amount: number;
      description?: string | null;
      estimated_days?: number | null;
      valid_until?: string | null;
      quote_document_path?: string | null;
      notes?: string | null;
    }) => {
      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');

      const { data, error } = await supabase
        .from('maintenance_quotes' as any)
        .insert({ ...quote, org_id: orgId, status: 'pending' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance_quotes', vars.maintenance_request_id] });
      toast({ title: 'Quote added' });
    },
    onError: (error) => {
      toast({ title: 'Failed to add quote', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateQuoteStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      // Update this quote
      const { error } = await supabase
        .from('maintenance_quotes' as any)
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', quoteId);
      if (error) throw error;

      // If accepted: reject all others, update estimated cost, set status to approved
      if (status === 'accepted') {
        await supabase
          .from('maintenance_quotes' as any)
          .update({ status: 'rejected', updated_at: new Date().toISOString() })
          .eq('maintenance_request_id', requestId)
          .neq('id', quoteId);

        if (amount) {
          await supabase
            .from('maintenance_requests')
            .update({ estimated_cost: amount, status: 'approved' } as any)
            .eq('id', requestId);
        }
      }

      return { quoteId, requestId, status };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance_quotes', result.requestId] });
      queryClient.invalidateQueries({ queryKey: ['maintenance_requests'] });
      toast({ title: result.status === 'accepted' ? 'Quote accepted' : 'Quote rejected' });
    },
    onError: (error) => {
      toast({ title: 'Failed to update quote', description: error.message, variant: 'destructive' });
    },
  });
}

export function useSuggestedContractors(category: string | undefined) {
  return useQuery({
    queryKey: ['suggested_contractors', category],
    queryFn: async () => {
      const orgId = await getUserOrgId();
      if (!orgId) return [];

      const { data, error } = await supabase
        .from('compliance_contractors_v2')
        .select('id, company_name, contact_name, phone, email, service_types, rating')
        .eq('org_id', orgId)
        .contains('service_types', [category!]);
      if (error) throw error;
      return data || [];
    },
    enabled: !!category,
  });
}
