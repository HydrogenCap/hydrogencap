import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId } from './useUserOrg';
import { useToast } from '@/hooks/use-toast';

export interface CommunicationAttachment {
  name: string;
  url: string;
  type: string;
}

export interface CommunicationRecord {
  id: string;
  org_id: string;
  property_id: string | null;
  tenant_id: string | null;
  contractor_id: string | null;
  direction: 'outbound' | 'inbound';
  channel: 'email' | 'sms' | 'phone' | 'letter' | 'in_person' | 'portal' | 'whatsapp' | 'other';
  subject: string | null;
  content: string;
  attachments: CommunicationAttachment[];
  sent_by: string | null;
  sent_at: string;
  delivered_at: string | null;
  read_at: string | null;
  proof_of_service: string | null;
  witness_name: string | null;
  reference_number: string | null;
  related_to_type: 'maintenance_request' | 'rent_arrears' | 'tenancy' | 'inspection' | 'compliance' | 'possession' | 'general' | null;
  related_to_id: string | null;
  is_locked: boolean;
  created_at: string;
}

export type CommunicationDirection = CommunicationRecord['direction'];
export type CommunicationChannel = CommunicationRecord['channel'];
export type CommunicationRelatedType = NonNullable<CommunicationRecord['related_to_type']>;

export interface CommunicationFilters {
  propertyId?: string;
  tenantId?: string;
  contractorId?: string;
  direction?: CommunicationDirection;
  channel?: CommunicationChannel;
  relatedToType?: CommunicationRelatedType;
  relatedToId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface LogCommunicationInput {
  property_id?: string | null;
  tenant_id?: string | null;
  contractor_id?: string | null;
  direction: CommunicationDirection;
  channel: CommunicationChannel;
  subject?: string | null;
  content: string;
  attachments?: CommunicationAttachment[];
  sent_at?: string;
  delivered_at?: string | null;
  read_at?: string | null;
  proof_of_service?: string | null;
  witness_name?: string | null;
  reference_number?: string | null;
  related_to_type?: CommunicationRelatedType | null;
  related_to_id?: string | null;
}

function buildQuery(orgId: string, filters?: CommunicationFilters) {
  let query = (supabase as any)
    .from('communication_log')
    .select('*')
    .eq('org_id', orgId)
    .order('sent_at', { ascending: false });

  if (filters?.propertyId) query = query.eq('property_id', filters.propertyId);
  if (filters?.tenantId) query = query.eq('tenant_id', filters.tenantId);
  if (filters?.contractorId) query = query.eq('contractor_id', filters.contractorId);
  if (filters?.direction) query = query.eq('direction', filters.direction);
  if (filters?.channel) query = query.eq('channel', filters.channel);
  if (filters?.relatedToType) query = query.eq('related_to_type', filters.relatedToType);
  if (filters?.relatedToId) query = query.eq('related_to_id', filters.relatedToId);
  if (filters?.dateFrom) query = query.gte('sent_at', filters.dateFrom);
  if (filters?.dateTo) query = query.lte('sent_at', filters.dateTo);
  if (filters?.search) query = query.or(`subject.ilike.%${filters.search}%,content.ilike.%${filters.search}%`);

  return query;
}

export function useCommunications(filters?: CommunicationFilters) {
  return useQuery({
    queryKey: ['communication_log', filters],
    queryFn: async () => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await buildQuery(orgId, filters);
      if (error) throw error;
      return (data || []) as unknown as CommunicationRecord[];
    },
  });
}

export function useLogCommunication() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: LogCommunicationInput) => {
      const orgId = await fetchUserOrgId();
      const { data: { user } } = await supabase.auth.getUser();

      const payload = {
        org_id: orgId,
        sent_by: user?.id ?? null,
        property_id: input.property_id ?? null,
        tenant_id: input.tenant_id ?? null,
        contractor_id: input.contractor_id ?? null,
        direction: input.direction,
        channel: input.channel,
        subject: input.subject ?? null,
        content: input.content,
        attachments: input.attachments ?? [],
        sent_at: input.sent_at ?? new Date().toISOString(),
        delivered_at: input.delivered_at ?? null,
        read_at: input.read_at ?? null,
        proof_of_service: input.proof_of_service ?? null,
        witness_name: input.witness_name ?? null,
        reference_number: input.reference_number ?? null,
        related_to_type: input.related_to_type ?? null,
        related_to_id: input.related_to_id ?? null,
        is_locked: true,
      };

      const { data, error } = await (supabase as any)
        .from('communication_log')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CommunicationRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communication_log'] });
      toast({ title: 'Communication logged', description: 'This record is now immutable and cannot be edited.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to log communication', description: error.message, variant: 'destructive' });
    },
  });
}

export function usePropertyCommunications(propertyId: string | undefined) {
  return useCommunications(propertyId ? { propertyId } : undefined);
}

export function useTenantCommunications(tenantId: string | undefined) {
  return useCommunications(tenantId ? { tenantId } : undefined);
}

export function useRelatedCommunications(relatedToType: string | undefined, relatedToId: string | undefined) {
  return useQuery({
    queryKey: ['communication_log', 'related', relatedToType, relatedToId],
    queryFn: async () => {
      if (!relatedToType || !relatedToId) return [];
      const orgId = await fetchUserOrgId();
      const { data, error } = await (supabase as any)
        .from('communication_log')
        .select('*')
        .eq('org_id', orgId)
        .eq('related_to_type', relatedToType)
        .eq('related_to_id', relatedToId)
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as CommunicationRecord[];
    },
    enabled: !!relatedToType && !!relatedToId,
  });
}

export function useExportCommunications(filters?: CommunicationFilters) {
  return useQuery({
    queryKey: ['communication_log_export', filters],
    queryFn: async () => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await buildQuery(orgId, filters);
      if (error) throw error;
      return (data || []) as unknown as CommunicationRecord[];
    },
    enabled: false, // Only runs when refetch() is called
  });
}
