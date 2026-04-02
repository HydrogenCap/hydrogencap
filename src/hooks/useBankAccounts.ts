import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId as getUserOrgId } from './useUserOrg';
import { useToast } from '@/hooks/use-toast';

export interface BankAccount {
  id: string;
  org_id: string;
  entity_id: string;
  account_name: string;
  bank_name: string;
  sort_code: string | null;
  account_number: string | null;
  account_type: string;
  currency: string;
  is_primary: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BankAccountWithEntity extends BankAccount {
  entity: {
    id: string;
    entity_name: string;
  };
}

export function useBankAccounts() {
  return useQuery({
    queryKey: ['bank_accounts'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('bank_accounts')
        .select('*, entity:legal_entities(id, entity_name)')
        .order('account_name');
      if (error) throw error;
      return data as BankAccountWithEntity[];
    },
  });
}

export function useCreateBankAccount() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (account: Omit<BankAccount, 'id' | 'org_id' | 'created_at' | 'updated_at'>) => {
      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');
      const { data, error } = await (supabase as any)
        .from('bank_accounts')
        .insert({ ...account, org_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank_accounts'] });
      toast({ title: 'Bank account added' });
    },
    onError: (error) => {
      toast({ title: 'Failed to add bank account', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateBankAccount() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BankAccount> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from('bank_accounts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank_accounts'] });
      toast({ title: 'Bank account updated' });
    },
    onError: (error) => {
      toast({ title: 'Failed to update', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteBankAccount() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bank_accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank_accounts'] });
      toast({ title: 'Bank account deleted' });
    },
    onError: (error) => {
      toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' });
    },
  });
}
