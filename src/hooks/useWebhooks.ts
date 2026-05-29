import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { useUserOrg } from '@/hooks/useUserOrg';
import { toast } from "sonner";

export interface WebhookEndpoint {
  id: string;
  org_id: string;
  url: string;
  secret: string;
  description: string | null;
  events: string[];
  is_active: boolean;
  created_at: string;
}

export interface WebhookDelivery {
  id: string;
  endpoint_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  response_status: number | null;
  response_body: string | null;
  attempt_count: number;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  next_retry_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

export function useWebhookEndpoints() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['webhook-endpoints', orgId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('webhook_endpoints')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as WebhookEndpoint[];
    },
    enabled: !!orgId,
  });
}

export function useCreateEndpoint() {
  const queryClient = useQueryClient();
  const { data: orgId } = useUserOrg();
  return useMutation({
    mutationFn: async (input: { url: string; description?: string; events: string[] }) => {
      if (!orgId) throw new Error('No organization');

      const { data, error } = await supabaseAny
        .from('webhook_endpoints')
        .insert({ org_id: orgId, ...input })
        .select()
        .single();

      if (error) throw error;
      return data as WebhookEndpoint;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      toast.success('Webhook endpoint created');
    },
    onError: (error: Error) => {
      toast.error('Failed to create endpoint', { description: error.message });
    },
  });
}

export function useUpdateEndpoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WebhookEndpoint> & { id: string }) => {
      const { data, error } = await supabaseAny
        .from('webhook_endpoints')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as WebhookEndpoint;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      toast.success('Webhook endpoint updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update endpoint', { description: error.message });
    },
  });
}

export function useDeleteEndpoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseAny
        .from('webhook_endpoints')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      toast.success('Webhook endpoint deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete endpoint', { description: error.message });
    },
  });
}

export function useWebhookDeliveries(endpointId: string | undefined) {
  return useQuery({
    queryKey: ['webhook-deliveries', endpointId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('webhook_deliveries')
        .select('*')
        .eq('endpoint_id', endpointId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as WebhookDelivery[];
    },
    enabled: !!endpointId,
  });
}

export function useTestWebhook() {
  const { data: orgId } = useUserOrg();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (_endpointId: string) => {
      if (!orgId) throw new Error('No organization');

      const { data, error } = await supabase.functions.invoke('dispatch-webhook', {
        body: {
          event_type: 'ping',
          payload: { ping: true, timestamp: new Date().toISOString() },
          org_id: orgId,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-deliveries'] });
      toast.success('Test ping sent');
    },
    onError: (error: Error) => {
      toast.error('Test ping failed', { description: error.message });
    },
  });
}
