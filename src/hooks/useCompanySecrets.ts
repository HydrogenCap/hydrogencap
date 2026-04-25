import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CompanySecretsMasked {
  company_id: string;
  auth_code_masked: string | null;
  utr_masked: string | null;
  auth_code_last4: string | null;
  utr_last4: string | null;
  updated_at: string | null;
}

interface RevealedSecrets {
  auth_code: string | null;
  utr: string | null;
}

// Fetch masked secrets for a company (for display)
export function useCompanySecretsMasked(companyId: string | undefined) {
  return useQuery({
    queryKey: ['company-secrets-masked', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      
      const { data, error } = await supabaseAny
        .from('company_secrets')
        .select('company_id, auth_code_last4, utr_last4, updated_at')
        .eq('company_id', companyId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!data) return null;

      // Format masked values
      return {
        company_id: data.company_id,
        auth_code_masked: data.auth_code_last4 ? `••••${data.auth_code_last4}` : null,
        utr_masked: data.utr_last4 ? `••••••${data.utr_last4}` : null,
        auth_code_last4: data.auth_code_last4,
        utr_last4: data.utr_last4,
        updated_at: data.updated_at,
      } as CompanySecretsMasked;
    },
    enabled: !!companyId,
  });
}

// Reveal (decrypt) secrets - requires admin role
export function useRevealSecrets() {
  return useMutation({
    mutationFn: async (companyId: string): Promise<RevealedSecrets> => {
      const { data, error } = await supabase.functions.invoke('company-secrets', {
        body: { action: 'get', company_id: companyId },
      });

      if (error) {
        throw new Error(error.message || 'Failed to reveal secrets');
      }

      return data as RevealedSecrets;
    },
  });
}

// Set/update secrets
export function useSetCompanySecrets() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      companyId,
      authCode,
      utr,
    }: {
      companyId: string;
      authCode?: string;
      utr?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('company-secrets', {
        body: { 
          action: 'set', 
          company_id: companyId,
          auth_code: authCode,
          utr: utr,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to save secrets');
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['company-secrets-masked', variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast({ title: 'Secrets saved securely' });
    },
    onError: (error) => {
      toast({ 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to save secrets',
        variant: 'destructive',
      });
    },
  });
}

// Bulk set secrets (for admin backfill)
export function useBulkSetSecrets() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (secrets: Array<{ company_number: string; auth_code?: string; utr?: string }>) => {
      const { data, error } = await supabase.functions.invoke('company-secrets', {
        body: { 
          action: 'bulk_set', 
          secrets,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to bulk set secrets');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-secrets-masked'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast({ title: 'Bulk secrets saved successfully' });
    },
    onError: (error) => {
      toast({ 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to bulk set secrets',
        variant: 'destructive',
      });
    },
  });
}
