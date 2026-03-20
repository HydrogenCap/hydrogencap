import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface FreeAgentConnection {
  id: string;
  org_id: string;
  company_id: string;
  entity_id: string | null;
  freeagent_company_name: string | null;
  freeagent_company_url: string | null;
  token_expires_at: string;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  last_sync_items_count: number;
  rent_income_category_url: string | null;
  expense_category_url: string | null;
  bank_account_url: string | null;
  auto_sync_enabled: boolean;
  sync_rent_payments: boolean;
  sync_expenses: boolean;
  use_sandbox: boolean;
  connected_by: string | null;
  connected_at: string;
  updated_at: string;
}

export interface FreeAgentCategory {
  url: string;
  description: string;
  nominal_code: string;
  group: string;
  allowable_for_tax: boolean;
  tax_reporting_name: string;
  auto_sales_tax_rate: string;
}

export interface FreeAgentBankAccount {
  url: string;
  name: string;
  type: string;
  currency: string;
  opening_balance: string;
}

export function useFreeAgentConnections() {
  return useQuery({
    queryKey: ['freeagent-connections'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('freeagent_connections')
        .select('*')
        .order('connected_at', { ascending: false });
      if (error) throw error;
      return data as FreeAgentConnection[];
    },
  });
}

export function useFreeAgentConnectionForEntity(entityId: string) {
  return useQuery({
    queryKey: ['freeagent-connections', entityId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('freeagent_connections')
        .select('*')
        .eq('entity_id', entityId)
        .maybeSingle();
      if (error) throw error;
      return data as FreeAgentConnection | null;
    },
    enabled: !!entityId,
  });
}

/** @deprecated Use useFreeAgentConnectionForEntity instead */
export function useFreeAgentConnectionForCompany(companyId: string) {
  return useQuery({
    queryKey: ['freeagent-connections', companyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('freeagent_connections')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();
      if (error) throw error;
      return data as FreeAgentConnection | null;
    },
    enabled: !!companyId,
  });
}

export function useFreeAgentCategories(entityOrCompanyId: string) {
  return useQuery({
    queryKey: ['freeagent-categories', entityOrCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('freeagent-fetch-categories', {
        body: { entityId: entityOrCompanyId },
      });
      if (error) throw error;
      return data as { categories: FreeAgentCategory[]; bank_accounts: FreeAgentBankAccount[] };
    },
    enabled: !!entityOrCompanyId,
    staleTime: 1000 * 60 * 10,
  });
}

export function useDisconnectFreeAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (connectionId: string) => {
      const { error } = await (supabase as any)
        .from('freeagent_connections')
        .delete()
        .eq('id', connectionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['freeagent-connections'] });
    },
  });
}

export function useUpdateFreeAgentSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FreeAgentConnection> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from('freeagent_connections')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['freeagent-connections'] });
      toast({ title: 'FreeAgent settings updated' });
    },
    onError: (error) => {
      toast({ title: 'Failed to update', description: error.message, variant: 'destructive' });
    },
  });
}

export function useSyncToFreeAgent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (entityOrCompanyId: string) => {
      const { data, error } = await supabase.functions.invoke('freeagent-sync-payments', {
        body: { entityId: entityOrCompanyId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['freeagent-connections'] });
      const msg = data.synced > 0
        ? `${data.synced} payment${data.synced !== 1 ? 's' : ''} synced to FreeAgent`
        : 'All payments already synced';
      toast({ title: 'FreeAgent sync complete', description: msg });
    },
    onError: (error) => {
      toast({ title: 'Sync failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function buildFreeAgentAuthUrl(
  entityId: string,
  orgId: string,
  userId: string,
  useSandbox: boolean = false
): string {
  const FREEAGENT_CLIENT_ID = import.meta.env.VITE_FREEAGENT_CLIENT_ID || '';
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
  const redirectUri = `${SUPABASE_URL}/functions/v1/freeagent-oauth-callback`;

  // CSRF protection: generate a random nonce and store it in sessionStorage
  const nonce = crypto.randomUUID();
  sessionStorage.setItem('freeagent_oauth_nonce', nonce);

  const state = btoa(JSON.stringify({ entityId, orgId, userId, useSandbox, nonce }));

  const authBase = useSandbox ? "https://api.sandbox.freeagent.com" : "https://api.freeagent.com";

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: FREEAGENT_CLIENT_ID,
    redirect_uri: redirectUri,
    state,
  });

  return `${authBase}/v2/approve_app?${params.toString()}`;
}
