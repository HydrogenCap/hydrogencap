import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useUserOrg } from '@/hooks/useUserOrg';
import { toast } from "sonner";

type FreeAgentConnectionRow = Database['public']['Tables']['freeagent_connections']['Row'];
type FreeAgentConnectionUpdate = Database['public']['Tables']['freeagent_connections']['Update'];
type FreeAgentSyncResult = { synced?: number };

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

function mapFreeAgentConnection(row: FreeAgentConnectionRow): FreeAgentConnection {
  return {
    id: row.id,
    org_id: row.org_id,
    company_id: row.company_id,
    entity_id: row.entity_id,
    freeagent_company_name: row.freeagent_company_name,
    freeagent_company_url: row.freeagent_company_url,
    token_expires_at: row.token_expires_at,
    last_sync_at: row.last_sync_at,
    last_sync_status: row.last_sync_status,
    last_sync_error: row.last_sync_error,
    last_sync_items_count: row.last_sync_items_count ?? 0,
    rent_income_category_url: row.rent_income_category_url,
    expense_category_url: row.expense_category_url,
    bank_account_url: row.bank_account_url,
    auto_sync_enabled: row.auto_sync_enabled ?? false,
    sync_rent_payments: row.sync_rent_payments ?? false,
    sync_expenses: row.sync_expenses ?? false,
    use_sandbox: row.use_sandbox ?? false,
    connected_by: row.connected_by,
    connected_at: row.connected_at,
    updated_at: row.updated_at,
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

export function useFreeAgentConnections() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['freeagent-connections', orgId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('freeagent_connections')
        .select('*')
        .eq('org_id', orgId!)
        .order('connected_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapFreeAgentConnection);
    },
    enabled: !!orgId,
  });
}

export function useFreeAgentConnectionForEntity(entityId: string) {
  return useQuery({
    queryKey: ['freeagent-connections', entityId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('freeagent_connections')
        .select('*')
        .eq('entity_id', entityId)
        .maybeSingle();
      if (error) throw error;
      return data ? mapFreeAgentConnection(data) : null;
    },
    enabled: !!entityId,
  });
}

/** @deprecated Use useFreeAgentConnectionForEntity instead */
export function useFreeAgentConnectionForCompany(companyId: string) {
  return useQuery({
    queryKey: ['freeagent-connections', companyId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('freeagent_connections')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();
      if (error) throw error;
      return data ? mapFreeAgentConnection(data) : null;
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
      const { error } = await supabaseAny
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
  return useMutation({
    mutationFn: async ({ id, ...updates }: FreeAgentConnectionUpdate & { id: string }) => {
      const { data, error } = await supabaseAny
        .from('freeagent_connections')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return mapFreeAgentConnection(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['freeagent-connections'] });
      toast.success('FreeAgent settings updated');
    },
    onError: (error) => {
      toast.error('Failed to update', { description: getErrorMessage(error) });
    },
  });
}

export function useSyncToFreeAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entityOrCompanyId: string) => {
      const { data, error } = await supabase.functions.invoke<FreeAgentSyncResult>('freeagent-sync-payments', {
        body: { entityId: entityOrCompanyId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['freeagent-connections'] });
      const syncedCount = data?.synced ?? 0;
      const msg = syncedCount > 0
        ? `${syncedCount} payment${syncedCount !== 1 ? 's' : ''} synced to FreeAgent`
        : 'All payments already synced';
      toast.success('FreeAgent sync complete', { description: msg });
    },
    onError: (error) => {
      toast.error('Sync failed', { description: getErrorMessage(error) });
    },
  });
}

export function buildFreeAgentAuthUrl(
  entityId: string,
  orgId: string,
  userId: string,
  useSandbox: boolean = false
): string {
  const FREEAGENT_CLIENT_ID = import.meta.env.VITE_FREEAGENT_CLIENT_ID || 'ctJauXO4z3j4tDVb8JMCXw';
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
