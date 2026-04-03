import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrg } from '@/hooks/useUserOrg';
import { useToast } from '@/hooks/use-toast';

// ── Types ──

export interface InvestorKYC {
  id: string;
  investor_id: string;
  org_id: string;
  id_document_type: string | null;
  id_document_url: string | null;
  id_verified: boolean;
  id_verified_at: string | null;
  proof_of_address_type: string | null;
  proof_of_address_url: string | null;
  address_verified: boolean;
  source_of_funds: string | null;
  source_of_funds_verified: boolean;
  source_of_funds_doc_url: string | null;
  pep_check_completed: boolean;
  sanctions_check_completed: boolean;
  pep_sanctions_clear: boolean | null;
  kyc_status: string;
  approved_by: string | null;
  approved_at: string | null;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface CapitalCall {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  total_amount: number;
  due_date: string;
  status: string;
  created_at: string;
}

export interface CapitalCallItem {
  id: string;
  capital_call_id: string;
  investor_id: string;
  amount: number;
  paid_amount: number;
  status: string;
  paid_at: string | null;
  payment_reference: string | null;
}

// ── KYC Hooks ──

export function useInvestorKYC(investorId: string | undefined) {
  return useQuery({
    queryKey: ['investor-kyc', investorId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('investor_kyc')
        .select('*')
        .eq('investor_id', investorId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as InvestorKYC | null;
    },
    enabled: !!investorId,
  });
}

export function useUpdateKYC() {
  const queryClient = useQueryClient();
  const { data: orgId } = useUserOrg();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ investorId, data }: { investorId: string; data: Partial<InvestorKYC> }) => {
      // Check if KYC record exists
      const { data: existing } = await (supabase as any)
        .from('investor_kyc')
        .select('id')
        .eq('investor_id', investorId)
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { data: result, error } = await (supabase as any)
          .from('investor_kyc')
          .update(data)
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return result;
      } else {
        const { data: result, error } = await (supabase as any)
          .from('investor_kyc')
          .insert([{ ...data, investor_id: investorId, org_id: orgId! }])
          .select()
          .single();
        if (error) throw error;
        return result;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investor-kyc'] });
      toast({ title: 'KYC updated' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error updating KYC', description: err.message, variant: 'destructive' });
    },
  });
}

export function useApproveKYC() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (kycId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      const { data: result, error } = await (supabase as any)
        .from('investor_kyc')
        .update({
          kyc_status: 'approved',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString().split('T')[0],
        })
        .eq('id', kycId)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investor-kyc'] });
      toast({ title: 'KYC approved' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error approving KYC', description: err.message, variant: 'destructive' });
    },
  });
}

// ── Capital Call Hooks ──

export function useCapitalCalls() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['capital-calls', orgId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('capital_calls')
        .select('*')
        .eq('org_id', orgId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CapitalCall[];
    },
    enabled: !!orgId,
  });
}

export function useCreateCapitalCall() {
  const queryClient = useQueryClient();
  const { data: orgId } = useUserOrg();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      total_amount: number;
      due_date: string;
      items: { investor_id: string; amount: number }[];
    }) => {
      const { items, ...callData } = data;
      const { data: call, error: callError } = await (supabase as any)
        .from('capital_calls')
        .insert([{ ...callData, org_id: orgId! }])
        .select()
        .single();
      if (callError) throw callError;

      if (items.length > 0) {
        const callItems = items.map(item => ({
          capital_call_id: call.id,
          investor_id: item.investor_id,
          amount: item.amount,
        }));
        const { error: itemsError } = await (supabase as any)
          .from('capital_call_items')
          .insert(callItems);
        if (itemsError) throw itemsError;
      }

      return call;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capital-calls'] });
      queryClient.invalidateQueries({ queryKey: ['capital-call-items'] });
      toast({ title: 'Capital call created' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error creating capital call', description: err.message, variant: 'destructive' });
    },
  });
}

export function useCapitalCallItems(callId: string | undefined) {
  return useQuery({
    queryKey: ['capital-call-items', callId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('capital_call_items')
        .select('*')
        .eq('capital_call_id', callId!);
      if (error) throw error;
      return data as CapitalCallItem[];
    },
    enabled: !!callId,
  });
}

export function useInvestorCapitalCallItems(investorId: string | undefined) {
  return useQuery({
    queryKey: ['investor-capital-call-items', investorId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('capital_call_items')
        .select('*, capital_calls(*)')
        .eq('investor_id', investorId!);
      if (error) throw error;
      return data as (CapitalCallItem & { capital_calls: CapitalCall })[];
    },
    enabled: !!investorId,
  });
}

export function useRecordCapitalPayment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      itemId: string;
      paid_amount: number;
      payment_reference?: string;
    }) => {
      // Get current item to calculate new total
      const { data: item, error: fetchError } = await (supabase as any)
        .from('capital_call_items')
        .select('*, capital_calls(total_amount)')
        .eq('id', data.itemId)
        .single();
      if (fetchError) throw fetchError;

      const newPaidAmount = (item.paid_amount || 0) + data.paid_amount;
      const newStatus = newPaidAmount >= item.amount ? 'paid' : 'partial';

      const { data: result, error } = await (supabase as any)
        .from('capital_call_items')
        .update({
          paid_amount: newPaidAmount,
          status: newStatus,
          paid_at: new Date().toISOString(),
          payment_reference: data.payment_reference || item.payment_reference,
        })
        .eq('id', data.itemId)
        .select()
        .single();
      if (error) throw error;

      // Update parent capital call status
      const { data: allItems } = await (supabase as any)
        .from('capital_call_items')
        .select('*')
        .eq('capital_call_id', item.capital_call_id);

      if (allItems) {
        const totalPaid = allItems.reduce((s: number, i: CapitalCallItem) =>
          s + (i.id === data.itemId ? newPaidAmount : (i.paid_amount || 0)), 0);
        const totalAmount = allItems.reduce((s: number, i: CapitalCallItem) => s + i.amount, 0);
        const allPaid = allItems.every((i: CapitalCallItem) =>
          i.id === data.itemId ? newPaidAmount >= i.amount : i.status === 'paid');

        const callStatus = allPaid ? 'fully_funded' : totalPaid > 0 ? 'partially_funded' : 'issued';
        await (supabase as any)
          .from('capital_calls')
          .update({ status: callStatus })
          .eq('id', item.capital_call_id);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capital-calls'] });
      queryClient.invalidateQueries({ queryKey: ['capital-call-items'] });
      queryClient.invalidateQueries({ queryKey: ['investor-capital-call-items'] });
      toast({ title: 'Payment recorded' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error recording payment', description: err.message, variant: 'destructive' });
    },
  });
}
