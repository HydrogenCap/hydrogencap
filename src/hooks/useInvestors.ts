import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useUserOrg } from '@/hooks/useUserOrg';
import { toast } from "sonner";

type InvestorInsert = Database['public']['Tables']['investors']['Insert'];

export interface Investor {
  id: string;
  investor_name: string;
  investor_type: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  contact_person: string | null;
  address: string | null;
  tax_residency: string | null;
  preferred_currency: string | null;
  accredited_investor: boolean | null;
  kyc_completed: boolean | null;
  kyc_completed_date: string | null;
  risk_profile: string | null;
  communication_preference: string | null;
  portal_access_enabled: boolean | null;
  portal_user_id: string | null;
  notes: string | null;
  org_id: string;
  created_at: string;
  updated_at: string;
}

export interface InvestorPortfolioSummary {
  investor_id: string;
  investor_name: string;
  investor_type: string;
  email: string | null;
  entities_invested: number;
  total_commitments: number;
  total_committed: number;
  total_drawn: number;
  total_undrawn: number;
  total_distributed: number;
  total_dividends: number;
  total_interest: number;
  total_capital_returned: number;
  distribution_multiple: number;
}

export type InvestorFormData = Omit<Investor, 'id' | 'org_id' | 'created_at' | 'updated_at'>;

export function useInvestors() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['investors', orgId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('investors')
        .select('*')
        .eq('org_id', orgId!)
        .order('investor_name');
      if (error) throw error;
      return data as Investor[];
    },
    enabled: !!orgId,
  });
}

export function useInvestorPortfolioSummaries() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['investor-portfolio-summaries', orgId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('investor_portfolio_summary')
        .select('*')
        .eq('org_id', orgId!);
      if (error) throw error;
      return data as InvestorPortfolioSummary[];
    },
    enabled: !!orgId,
  });
}

export function useCreateInvestor() {
  const queryClient = useQueryClient();
  const { data: orgId } = useUserOrg();
  return useMutation({
    mutationFn: async (data: Partial<InvestorFormData>) => {
      const payload = { ...data, org_id: orgId! } as InvestorInsert;
      const { data: result, error } = await supabaseAny
        .from('investors')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investors'] });
      queryClient.invalidateQueries({ queryKey: ['investor-portfolio-summaries'] });
      toast.success('Investor created');
    },
    onError: (err: Error) => {
      toast.error('Error creating investor', { description: err.message });
    },
  });
}

export function useUpdateInvestor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InvestorFormData> }) => {
      const { data: result, error } = await supabaseAny
        .from('investors')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investors'] });
      queryClient.invalidateQueries({ queryKey: ['investor-portfolio-summaries'] });
      toast.success('Investor updated');
    },
    onError: (err: Error) => {
      toast.error('Error updating investor', { description: err.message });
    },
  });
}

export function useSendInvestorPortalAccessEmail() {
  return useMutation({
    mutationFn: async (investorId: string) => {
      const { error } = await supabase.functions.invoke('send-investor-portal-access', {
        body: { investorId },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Portal access email sent');
    },
    onError: (err: Error) => {
      toast.error('Failed to send portal access email', { description: err.message });
    },
  });
}
